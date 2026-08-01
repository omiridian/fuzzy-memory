// Flattens family trees into the dex: a flat map of species records with
// generated learnsets, palettes, catch rates and evolution links.

import { FAMILIES } from './families.js';
import { generateFamilies } from './speciesgen.js';
import { MOVES, movesOfType } from './moves.js';
import { TYPE_INFO } from './types.js';
import { rngFromString } from '../core/rng.js';
import { sumValues } from '../core/util.js';

const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** "Flarehound" → "flarehound" */
function toId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ── Learnset construction ──────────────────────────────────────────────────

// Universal filler so nothing ever ends up with an empty move list.
const NEUTRAL_STARTERS = ['tackle', 'scratch', 'growl', 'leer'];

const STATUS_BY_ROLE = {
  physical: ['bulkup', 'howl', 'harden', 'dancewind', 'agility'],
  special: ['calmmind', 'nastyplot', 'chargeup', 'focus', 'emberdance'],
  bulky: ['harden', 'stonewall', 'platingup', 'sandsong', 'carapace', 'frostarmor'],
  utility: ['rest', 'recover', 'protect', 'roost', 'mistveil', 'lightscreen', 'barrier'],
};

/** Works out whether a species prefers physical or special attacks. */
function attackBias(stats) {
  if (stats.atk > stats.spa * 1.15) return 'physical';
  if (stats.spa > stats.atk * 1.15) return 'special';
  return 'mixed';
}

/** Sorted, deduplicated level-up list. */
function finaliseLearnset(entries) {
  const seen = new Set();
  const out = [];
  for (const [level, move] of entries.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]))) {
    if (seen.has(move) || !MOVES[move]) continue;
    seen.add(move);
    out.push({ level, move });
  }
  return out;
}

/**
 * Builds a level-up learnset for one species.
 * Guarantees: an early attack, same-type coverage across the level range,
 * off-type coverage, a setup move and at least one utility option.
 */
function buildLearnset(species, explicit, signature) {
  const rng = rngFromString('learn:' + species.id);
  const entries = explicit ? explicit.map(([l, m]) => [l, m]) : [];
  const stats = species.stats;
  const bias = attackBias(stats);
  const maxLevel = species.stage === 1 ? 45 : species.stage === 2 ? 55 : 66;

  const preferred = bias === 'mixed' ? rng.pick(['physical', 'special']) : bias;
  const other = preferred === 'physical' ? 'special' : 'physical';

  // Same-type attacks, sorted weakest to strongest across the level band.
  for (const type of species.types) {
    let pool = movesOfType(type, preferred);
    if (pool.length < 3) pool = pool.concat(movesOfType(type, other));
    const sorted = pool
      .slice()
      .sort((a, b) => MOVES[a].power - MOVES[b].power || a.localeCompare(b));
    const picks = [];
    const step = Math.max(1, Math.floor(sorted.length / 4));
    for (let i = 0; i < sorted.length && picks.length < 4; i += step) picks.push(sorted[i]);
    if (sorted.length && picks[picks.length - 1] !== sorted[sorted.length - 1]) {
      picks[picks.length - 1] = sorted[sorted.length - 1];
    }
    picks.forEach((moveId, i) => {
      const level = Math.round(1 + (maxLevel - 1) * (i / Math.max(1, picks.length - 1)) * 0.92);
      entries.push([Math.max(1, level), moveId]);
    });
  }

  // Off-type coverage: two moves from types this species does not have.
  const coverTypes = rng
    .shuffle(Object.keys(TYPE_INFO))
    .filter((t) => !species.types.includes(t))
    .slice(0, 2);
  for (const t of coverTypes) {
    const pool = movesOfType(t, preferred).concat(movesOfType(t, other));
    if (!pool.length) continue;
    const mid = pool.filter((m) => MOVES[m].power >= 55 && MOVES[m].power <= 95);
    const moveId = rng.pick(mid.length ? mid : pool);
    entries.push([rng.int(Math.floor(maxLevel * 0.4), Math.floor(maxLevel * 0.85)), moveId]);
  }

  // Setup and utility.
  const bulky = stats.def + stats.spd > stats.atk + stats.spa;
  const setupPool = bulky ? STATUS_BY_ROLE.bulky : STATUS_BY_ROLE[preferred];
  entries.push([rng.int(8, 26), rng.pick(setupPool)]);
  entries.push([rng.int(20, Math.max(24, maxLevel - 8)), rng.pick(STATUS_BY_ROLE.utility)]);

  // A status-inflicting option for roughly half the roster.
  if (rng.percent(50)) {
    const statusMoves = ['willowisp', 'toxify', 'paralyzecoil', 'hypnosis', 'confuse', 'leechseed', 'entropy', 'flashbang'];
    entries.push([rng.int(14, 40), rng.pick(statusMoves)]);
  }

  // Early filler so level-1 catches always have something to use.
  entries.push([1, rng.pick(NEUTRAL_STARTERS)]);
  if (!entries.some(([l]) => l <= 5 && MOVES[entries.find((e) => e[1])[1]])) {
    entries.push([1, 'tackle']);
  }

  if (signature) entries.push([Math.max(40, maxLevel - 4), signature]);

  const learnset = finaliseLearnset(entries);

  // Unevolved forms should not open with a heavy hitter; push anything strong
  // out of the first few levels so early routes stay gentle.
  if (species.stage === 1) {
    for (const entry of learnset) {
      if (entry.level <= 4 && MOVES[entry.move].power > 60) entry.level = 10;
    }
    learnset.sort((a, b) => a.level - b.level);
  }
  return learnset;
}

// ── Palette ────────────────────────────────────────────────────────────────
function buildPalette(species) {
  const rng = rngFromString('palette:' + species.id);
  const primary = TYPE_INFO[species.types[0]];
  const secondary = TYPE_INFO[species.types[1] || species.types[0]];
  const shift = (hex, amount) => {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount));
    const b = Math.min(255, Math.max(0, (num & 255) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  };
  return {
    body: shift(primary.color, rng.int(-18, 18)),
    shade: primary.dark,
    accent: secondary.color,
    eye: rng.pick(['#ffffff', '#fff3c4', '#d9f7ff', '#ffe0e0']),
    pupil: rng.pick(['#1b1b26', '#2a1420', '#101a2b']),
  };
}

// ── Derived numbers ────────────────────────────────────────────────────────
function catchRateFor(bst, stage, rarity) {
  if (rarity === 'legendary' || rarity === 'mythic') return 3;
  const base = 255 - Math.floor((bst - 280) * 0.42);
  const stagePenalty = (stage - 1) * 30;
  const rarityPenalty = rarity === 'rare' ? 45 : rarity === 'uncommon' ? 15 : 0;
  return Math.max(8, Math.min(255, base - stagePenalty - rarityPenalty));
}

function growthRateFor(bst, rarity) {
  if (rarity === 'legendary' || rarity === 'mythic') return 'slow';
  if (bst >= 500) return 'slow';
  if (bst >= 420) return 'mediumslow';
  if (bst >= 340) return 'medium';
  return 'fast';
}

/** Rough size figures, purely flavour for the summary screen. */
function sizeFor(species, rng) {
  const bulk = species.stats.hp + species.stats.def;
  const height = +(0.3 + (bulk / 260) * rng.float(0.8, 1.4) * species.stage).toFixed(1);
  const weight = +(1 + bulk * rng.float(0.15, 0.55) * species.stage).toFixed(1);
  return { height, weight };
}

// ── Flattening ─────────────────────────────────────────────────────────────
const DEX = {};
const DEX_ORDER = [];

function registerNode(node, family, stage, prevoId, dexCounter) {
  const id = toId(node.n);
  const stats = {};
  STAT_ORDER.forEach((k, i) => (stats[k] = node.b[i]));

  const species = {
    id,
    num: dexCounter.value++,
    name: node.n,
    types: node.t.slice(),
    stats,
    bst: sumValues(stats),
    abilities: node.ab.slice(),
    hiddenAbility: node.ha || null,
    plan: node.plan,
    family: family.id,
    stage,
    prevo: prevoId,
    evolutions: [],
    rarity: family.legendary ? (family.rarity === 'mythic' ? 'mythic' : 'legendary') : family.rarity || 'common',
    habitat: family.habitat || [],
    legendary: !!family.legendary,
    dex: node.dex,
    signature: node.sig || null,
    generated: !!family.generated,
  };

  species.catchRate = catchRateFor(species.bst, stage, species.rarity);
  species.growthRate = growthRateFor(species.bst, species.rarity);
  species.expYield = Math.floor(species.bst / 3.6) + stage * 6;
  species.baseMoney = Math.floor(species.bst / 8) + stage * 4;
  species.palette = buildPalette(species);
  const sizeRng = rngFromString('size:' + id);
  Object.assign(species, sizeFor(species, sizeRng));
  species.learnset = buildLearnset(species, node.moves, node.sig);

  DEX[id] = species;
  DEX_ORDER.push(id);

  for (const child of node.evo || []) {
    const childId = registerNode(child, family, stage + 1, id, dexCounter);
    species.evolutions.push({
      to: childId,
      ...normaliseRequirement(child.req || { lv: 30 }),
    });
  }
  return id;
}

function normaliseRequirement(req) {
  const out = { method: 'level' };
  if (req.item) {
    out.method = 'item';
    out.item = req.item;
  } else if (req.friendship) {
    out.method = 'friendship';
    out.friendship = req.friendship;
    out.level = req.lv || 1;
  } else {
    out.level = req.lv || 30;
  }
  if (req.cond) out.cond = req.cond;
  if (req.lv && out.method === 'item') out.level = req.lv;
  out.note = describeRequirement(out);
  return out;
}

function describeRequirement(req) {
  const cond = req.cond
    ? req.cond === 'day'
      ? ' in daylight'
      : req.cond === 'night'
      ? ' at night'
      : req.cond === 'atk>=spa'
      ? ' with Attack at or above Sp. Atk'
      : req.cond === 'spa>atk'
      ? ' with Sp. Atk above Attack'
      : ` (${req.cond})`
    : '';
  if (req.method === 'item') return `Use a ${req.item.replace(/_/g, ' ')}${cond}`;
  if (req.method === 'friendship') return `Level up with high friendship${cond}`;
  return `Level ${req.level}${cond}`;
}

// Build the dex once at module load: hand-authored families first so the
// starters keep the low dex numbers, then the generated roster.
const counter = { value: 1 };
const ALL_FAMILIES = [...FAMILIES, ...generateFamilies(6)];
for (const family of ALL_FAMILIES) {
  registerNode(family.root, family, 1, null, counter);
}

// ── Lookups ────────────────────────────────────────────────────────────────
export { DEX, DEX_ORDER, ALL_FAMILIES };

export const DEX_COUNT = DEX_ORDER.length;

export function getSpecies(id) {
  return DEX[id] || null;
}

export function speciesByNumber(num) {
  return DEX[DEX_ORDER[num - 1]] || null;
}

/** Every species that lives in a given habitat tag. */
export function speciesInHabitat(tag) {
  return DEX_ORDER.map((id) => DEX[id]).filter((s) => s.habitat.includes(tag));
}

/** The whole evolution line a species belongs to, root first. */
export function evolutionLine(id) {
  let root = DEX[id];
  if (!root) return [];
  while (root.prevo) root = DEX[root.prevo];
  const out = [];
  const walk = (s, depth) => {
    out.push({ species: s, depth });
    for (const evo of s.evolutions) walk(DEX[evo.to], depth + 1);
  };
  walk(root, 0);
  return out;
}

/** Base (unevolved) form of a line. */
export function baseFormOf(id) {
  let s = DEX[id];
  while (s && s.prevo) s = DEX[s.prevo];
  return s;
}

export const STARTER_IDS = ['emberkit', 'puddlet', 'sprigling'];

export const LEGENDARY_IDS = DEX_ORDER.filter((id) => DEX[id].legendary);
