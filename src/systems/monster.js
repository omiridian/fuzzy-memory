// Creature instances: creation, growth, stat maths, moves, friendship and
// evolution. A "mon" is a plain serialisable object — everything here takes
// one as its first argument so save files stay simple JSON.

import { DEX, getSpecies } from '../data/species.js';
import { MOVES, getMove, makeMoveSlot } from '../data/moves.js';
import { NATURE_LIST, natureMultiplier, STAT_KEYS } from '../data/natures.js';
import { RNG, rngFromString } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { getAbility } from '../data/abilities.js';
import { getItem } from '../data/items.js';

export const MAX_LEVEL = 100;
export const MAX_TRAINING_PER_STAT = 252;
export const MAX_TRAINING_TOTAL = 510;

let idCounter = 1;
export function nextMonUid() {
  return `m${(idCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
export function seedMonUid(n) {
  idCounter = Math.max(idCounter, n);
}

// ── Experience curves ──────────────────────────────────────────────────────
const CURVES = {
  fast: (n) => Math.floor((4 * n ** 3) / 5),
  medium: (n) => n ** 3,
  mediumslow: (n) => Math.max(0, Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140)),
  slow: (n) => Math.floor((5 * n ** 3) / 4),
};

export function expForLevel(growthRate, level) {
  const curve = CURVES[growthRate] || CURVES.medium;
  return curve(clamp(level, 1, MAX_LEVEL));
}

/** Level implied by a total experience value. */
export function levelFromExp(growthRate, exp) {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(growthRate, level + 1)) level++;
  return level;
}

/** Progress toward the next level as a 0..1 fraction. */
export function levelProgress(mon) {
  const species = getSpecies(mon.species);
  if (mon.level >= MAX_LEVEL) return 1;
  const cur = expForLevel(species.growthRate, mon.level);
  const next = expForLevel(species.growthRate, mon.level + 1);
  if (next === cur) return 1;
  return clamp((mon.exp - cur) / (next - cur), 0, 1);
}

export function expToNextLevel(mon) {
  const species = getSpecies(mon.species);
  if (mon.level >= MAX_LEVEL) return 0;
  return Math.max(0, expForLevel(species.growthRate, mon.level + 1) - mon.exp);
}

// ── Stats ──────────────────────────────────────────────────────────────────
export function computeStats(mon) {
  const species = getSpecies(mon.species);
  const stats = {};
  for (const key of STAT_KEYS) {
    const base = species.stats[key];
    const iv = mon.ivs[key];
    const ev = Math.floor((mon.evs[key] || 0) / 4);
    if (key === 'hp') {
      stats.hp = Math.floor(((2 * base + iv + ev) * mon.level) / 100) + mon.level + 10;
    } else {
      const raw = Math.floor(((2 * base + iv + ev) * mon.level) / 100) + 5;
      stats[key] = Math.floor(raw * natureMultiplier(mon.nature, key));
    }
  }
  return stats;
}

/** Recomputes cached stats, keeping current HP sensible. */
export function refreshStats(mon, { healToFull = false } = {}) {
  const before = mon.stats ? mon.stats.hp : null;
  mon.stats = computeStats(mon);
  if (healToFull) {
    mon.hp = mon.stats.hp;
  } else if (before !== null) {
    // Gaining max HP from a level-up should also give that much current HP.
    mon.hp = clamp(mon.hp + Math.max(0, mon.stats.hp - before), 0, mon.stats.hp);
  } else {
    mon.hp = mon.stats.hp;
  }
  return mon;
}

// ── Move selection ─────────────────────────────────────────────────────────
/** The four most recent level-up moves a species knows at a given level. */
export function defaultMovesFor(speciesId, level) {
  const species = getSpecies(speciesId);
  const known = species.learnset.filter((e) => e.level <= level).map((e) => e.move);
  const unique = [];
  for (const m of known) if (!unique.includes(m)) unique.push(m);
  return unique.slice(-4);
}

/** Moves learned exactly on reaching `level`. */
export function movesLearnedAt(speciesId, level) {
  return getSpecies(speciesId)
    .learnset.filter((e) => e.level === level)
    .map((e) => e.move);
}

/** Can this species ever learn this move (level-up list or a matching tome)? */
export function canLearnMove(speciesId, moveId) {
  const species = getSpecies(speciesId);
  if (species.learnset.some((e) => e.move === moveId)) return true;
  const move = getMove(moveId);
  if (!move) return false;
  // Tome compatibility: matching type, or a universal utility move.
  const universal = ['protect', 'rest', 'recover', 'bulkup', 'calmmind'];
  if (universal.includes(moveId)) return true;
  return species.types.includes(move.type);
}

export function teachMove(mon, moveId, slotIndex = null) {
  const slot = makeMoveSlot(moveId);
  if (!slot) return false;
  if (mon.moves.some((m) => m.id === moveId)) return false;
  if (mon.moves.length < 4 && slotIndex === null) {
    mon.moves.push(slot);
    return true;
  }
  const index = slotIndex === null ? 0 : slotIndex;
  mon.moves[index] = slot;
  return true;
}

// ── Creation ───────────────────────────────────────────────────────────────
function randomIVs(rng) {
  const ivs = {};
  for (const key of STAT_KEYS) ivs[key] = rng.int(0, 31);
  return ivs;
}

function emptyEVs() {
  const evs = {};
  for (const key of STAT_KEYS) evs[key] = 0;
  return evs;
}

/**
 * Creates a creature instance.
 * @param {string} speciesId
 * @param {number} level
 * @param {object} opts  { rng, ability, nature, ivs, moves, shiny, originalTrainer, friendship, held }
 */
export function createMon(speciesId, level, opts = {}) {
  const species = getSpecies(speciesId);
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  const rng = opts.rng || new RNG(Math.floor(Math.random() * 0xffffffff));
  level = clamp(level, 1, MAX_LEVEL);

  const abilityPool = species.abilities.slice();
  const ability =
    opts.ability ||
    (opts.hiddenAbility && species.hiddenAbility ? species.hiddenAbility : rng.pick(abilityPool));

  const mon = {
    uid: opts.uid || nextMonUid(),
    species: speciesId,
    nickname: null,
    level,
    exp: expForLevel(species.growthRate, level),
    nature: opts.nature || rng.pick(NATURE_LIST),
    ability,
    ivs: opts.ivs || randomIVs(rng),
    evs: opts.evs || emptyEVs(),
    moves: [],
    status: null,
    statusTurns: 0,
    hp: 0,
    stats: null,
    friendship: opts.friendship !== undefined ? opts.friendship : 70,
    shiny: opts.shiny !== undefined ? opts.shiny : rng.percent(0.4),
    held: opts.held || null,
    originalTrainer: opts.originalTrainer || null,
    caughtAt: opts.caughtAt || null,
    caughtLevel: level,
    metDate: opts.metDate || null,
  };

  const moveIds = opts.moves || defaultMovesFor(speciesId, level);
  for (const id of moveIds) {
    const slot = makeMoveSlot(id);
    if (slot) mon.moves.push(slot);
  }
  if (!mon.moves.length) mon.moves.push(makeMoveSlot('tackle'));

  refreshStats(mon, { healToFull: true });
  return mon;
}

/** A wild creature — deterministic when given a seeded RNG. */
export function createWild(speciesId, level, rng) {
  const species = getSpecies(speciesId);
  const mon = createMon(speciesId, level, {
    rng,
    hiddenAbility: rng.percent(5),
    friendship: 40,
  });
  // Wild creatures occasionally hold something.
  if (rng.percent(6)) {
    mon.held = rng.pick(['berrysweet', 'cleanseberry', 'herb', 'scrap', 'pearl']);
  }
  if (species.legendary) {
    // Legendaries roll better genes.
    for (const key of STAT_KEYS) mon.ivs[key] = Math.max(mon.ivs[key], rng.int(20, 31));
    refreshStats(mon, { healToFull: true });
  }
  return mon;
}

export function displayName(mon) {
  return mon.nickname || getSpecies(mon.species).name;
}

export function isFainted(mon) {
  return mon.hp <= 0;
}

export function healFully(mon) {
  mon.hp = mon.stats.hp;
  mon.status = null;
  mon.statusTurns = 0;
  for (const slot of mon.moves) slot.pp = slot.maxPp;
  return mon;
}

// ── Experience and levelling ───────────────────────────────────────────────
/**
 * Experience awarded for defeating `loser`.
 * Trainer battles pay more; level difference matters.
 */
export function expAward(loser, winnerLevel, { trainer = false, shared = 1 } = {}) {
  const species = getSpecies(loser.species);
  const base = species.expYield * loser.level;
  const scale = trainer ? 1.5 : 1;
  const diff = clamp((2 * loser.level + 10) / (loser.level + winnerLevel + 10), 0.4, 2.2);
  return Math.max(1, Math.floor(((base * scale) / (5 * shared)) * diff ** 2.5));
}

/**
 * Adds experience, handling level-ups.
 * Returns { levels: [{level, moves:[id]}], evolved: null }
 */
export function gainExp(mon, amount) {
  const species = getSpecies(mon.species);
  const result = { gained: 0, levels: [] };
  if (mon.level >= MAX_LEVEL) return result;
  const held = mon.held ? getItem(mon.held) : null;
  const mult = held && held.hold && held.hold.expMult ? held.hold.expMult : 1;
  amount = Math.floor(amount * mult);
  result.gained = amount;
  mon.exp += amount;

  const cap = expForLevel(species.growthRate, MAX_LEVEL);
  if (mon.exp > cap) mon.exp = cap;

  while (mon.level < MAX_LEVEL && mon.exp >= expForLevel(species.growthRate, mon.level + 1)) {
    mon.level++;
    refreshStats(mon);
    result.levels.push({ level: mon.level, moves: movesLearnedAt(mon.species, mon.level) });
    mon.friendship = clamp(mon.friendship + 2, 0, 255);
  }
  return result;
}

// ── Training values ────────────────────────────────────────────────────────
/** Adds training (EV) points, respecting per-stat and total caps. */
export function addTraining(mon, stat, amount) {
  const total = STAT_KEYS.reduce((sum, k) => sum + mon.evs[k], 0);
  const room = Math.min(MAX_TRAINING_PER_STAT - mon.evs[stat], MAX_TRAINING_TOTAL - total);
  const applied = clamp(amount, 0, Math.max(0, room));
  if (applied > 0) {
    mon.evs[stat] += applied;
    refreshStats(mon);
  }
  return applied;
}

/** Training awarded to the victor for defeating a species. */
export function trainingYield(speciesId) {
  const species = getSpecies(speciesId);
  // The defeated creature's two best base stats teach the most.
  const ranked = STAT_KEYS.slice().sort((a, b) => species.stats[b] - species.stats[a]);
  const out = {};
  out[ranked[0]] = species.stage >= 3 ? 3 : species.stage === 2 ? 2 : 1;
  if (species.bst >= 400) out[ranked[1]] = 1;
  return out;
}

export function applyTrainingYield(mon, speciesId) {
  const yields = trainingYield(speciesId);
  for (const stat in yields) addTraining(mon, stat, yields[stat]);
}

// ── Friendship ─────────────────────────────────────────────────────────────
export function addFriendship(mon, amount) {
  mon.friendship = clamp(mon.friendship + amount, 0, 255);
  return mon.friendship;
}

export function friendshipLabel(mon) {
  const f = mon.friendship;
  if (f >= 220) return 'inseparable from you';
  if (f >= 170) return 'very fond of you';
  if (f >= 120) return 'warming to you';
  if (f >= 70) return 'getting used to you';
  if (f >= 30) return 'wary of you';
  return 'unhappy';
}

// ── Evolution ──────────────────────────────────────────────────────────────
/**
 * Checks whether a creature should evolve.
 * @param {object} mon
 * @param {object} context { trigger: 'level'|'item', item, isNight }
 * @returns {null | {to, method, note}}
 */
export function checkEvolution(mon, context = {}) {
  const species = getSpecies(mon.species);
  if (!species.evolutions.length) return null;
  if (mon.held === 'everstone') return null;
  const trigger = context.trigger || 'level';
  const isNight = !!context.isNight;

  for (const evo of species.evolutions) {
    if (evo.method === 'item') {
      if (trigger !== 'item' || context.item !== evo.item) continue;
      if (evo.level && mon.level < evo.level) continue;
    } else if (evo.method === 'friendship') {
      if (trigger !== 'level') continue;
      if (mon.friendship < evo.friendship) continue;
      if (evo.level && mon.level < evo.level) continue;
    } else {
      if (trigger !== 'level') continue;
      if (mon.level < evo.level) continue;
    }
    if (!conditionMet(mon, evo.cond, isNight)) continue;
    return evo;
  }
  return null;
}

function conditionMet(mon, cond, isNight) {
  if (!cond) return true;
  if (cond === 'day') return !isNight;
  if (cond === 'night') return isNight;
  if (cond === 'atk>=spa') return mon.stats.atk >= mon.stats.spa;
  if (cond === 'spa>atk') return mon.stats.spa > mon.stats.atk;
  if (cond.startsWith('holding:')) return mon.held === cond.slice(8);
  return true;
}

/**
 * Performs an evolution in place.
 * Returns { from, to, newMoves } — newMoves are level-up moves the new form
 * knows at this level that the creature does not have yet.
 */
export function evolveMon(mon, toSpeciesId) {
  const from = getSpecies(mon.species);
  const to = getSpecies(toSpeciesId);
  if (!to) return null;
  const hpRatio = mon.hp / mon.stats.hp;

  mon.species = toSpeciesId;
  // Keep the ability slot where possible, otherwise take the first legal one.
  if (!to.abilities.includes(mon.ability) && mon.ability !== to.hiddenAbility) {
    const slot = from.abilities.indexOf(mon.ability);
    mon.ability = to.abilities[clamp(slot, 0, to.abilities.length - 1)] || to.abilities[0];
  }
  // Evolution levels can be behind the creature's actual level.
  mon.exp = Math.max(mon.exp, expForLevel(to.growthRate, mon.level));
  refreshStats(mon);
  mon.hp = Math.max(1, Math.round(mon.stats.hp * hpRatio));
  addFriendship(mon, 5);

  const known = new Set(mon.moves.map((m) => m.id));
  const newMoves = to.learnset
    .filter((e) => e.level <= mon.level && !known.has(e.move))
    .map((e) => e.move)
    .slice(-2);

  return { from: from.id, to: toSpeciesId, newMoves };
}

// ── Capture ────────────────────────────────────────────────────────────────
/**
 * Capture chance for one throw, 0..1.
 * Mirrors the classic shake-check maths: low HP, status and better orbs help.
 */
export function captureChance(target, orbMultiplier, { statusBonus = 1, turn = 1 } = {}) {
  const species = getSpecies(target.species);
  const maxHp = target.stats.hp;
  const hp = clamp(target.hp, 1, maxHp);
  const a =
    (((3 * maxHp - 2 * hp) * species.catchRate * orbMultiplier) / (3 * maxHp)) * statusBonus;
  if (a >= 255) return 1;
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
  const shake = b / 65535;
  return clamp(shake ** 4, 0, 1);
}

export function statusCaptureBonus(mon) {
  if (!mon.status) return 1;
  if (mon.status === 'sleep' || mon.status === 'freeze') return 2.5;
  if (mon.status === 'paralysis' || mon.status === 'poison' || mon.status === 'burn') return 1.5;
  if (mon.status === 'toxic') return 1.5;
  return 1.2;
}

/** Runs the four shake checks; returns { caught, shakes }. */
export function attemptCapture(target, orbMultiplier, rng, opts = {}) {
  const chance = captureChance(target, orbMultiplier, opts);
  if (chance >= 1) return { caught: true, shakes: 4 };
  const per = chance ** 0.25;
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng.next() < per) shakes++;
    else break;
  }
  return { caught: shakes === 4, shakes };
}

// ── Summary helpers ────────────────────────────────────────────────────────
export function abilityOf(mon) {
  return getAbility(mon.ability);
}

export function typeOf(mon) {
  return getSpecies(mon.species).types;
}

/** Highest stat name, used by a couple of ability effects and the UI. */
export function bestStat(mon) {
  let best = 'atk';
  for (const key of STAT_KEYS) {
    if (key === 'hp') continue;
    if (mon.stats[key] > mon.stats[best]) best = key;
  }
  return best;
}

/** A short, stable description for the party list. */
export function describeMon(mon) {
  const species = getSpecies(mon.species);
  return `${displayName(mon)} (${species.name}) Lv.${mon.level}`;
}

/** Rebuilds derived fields after loading a save. */
export function rehydrateMon(mon) {
  if (!DEX[mon.species]) return null;
  refreshStats(mon);
  mon.hp = clamp(mon.hp, 0, mon.stats.hp);
  for (const slot of mon.moves) {
    const move = MOVES[slot.id];
    if (move) slot.maxPp = move.pp;
  }
  mon.moves = mon.moves.filter((slot) => MOVES[slot.id]);
  return mon;
}

/** Deterministic creature for scripted trainers and gift events. */
export function scriptedMon(speciesId, level, seedKey, extra = {}) {
  return createMon(speciesId, level, { rng: rngFromString(seedKey), ...extra });
}
