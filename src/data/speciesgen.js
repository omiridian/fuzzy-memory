// Procedural family generator.
//
// The hand-authored families in families.js cover the story-critical creatures.
// This file fills out the rest of the roster: it builds evolution trees from
// per-type name banks, archetype stat spreads and flavour phrase banks, all
// driven by a fixed seed so the dex is identical on every machine and in every
// save file.

import { RNG, rngFromString } from '../core/rng.js';

// ── Name banks ─────────────────────────────────────────────────────────────
const STEMS = {
  ember: ['pyr', 'cind', 'ash', 'scorch', 'brand', 'coal', 'sear', 'ignis', 'flick', 'kiln', 'smold', 'char'],
  tide: ['brin', 'wade', 'shoal', 'murk', 'kelp', 'drift', 'reef', 'undin', 'squall', 'lagoon', 'trench', 'spume'],
  verdant: ['brack', 'thorn', 'fern', 'mulch', 'sap', 'bloss', 'briar', 'grove', 'petal', 'husk', 'vine', 'lich'],
  volt: ['zapp', 'arc', 'ohm', 'joule', 'flick', 'gleam', 'tesl', 'crackle', 'surge', 'volt', 'dyna', 'fuse'],
  frost: ['rime', 'hoar', 'sleet', 'floe', 'chill', 'glaci', 'brume', 'nival', 'flurr', 'shiver', 'crys', 'snow'],
  gale: ['zeph', 'kite', 'gust', 'skirl', 'aer', 'plume', 'thermal', 'squall', 'wisp', 'soar', 'drift', 'cirr'],
  stone: ['grit', 'shale', 'basalt', 'crag', 'flint', 'quarr', 'geode', 'tuff', 'scree', 'obsid', 'marl', 'ridge'],
  metal: ['ferro', 'cog', 'rivet', 'chrome', 'slag', 'anvil', 'gild', 'temper', 'bolt', 'plate', 'brass', 'shear'],
  toxin: ['mire', 'blight', 'venn', 'sludge', 'spore', 'fester', 'nettle', 'bile', 'rot', 'grime', 'toxi', 'wilt'],
  beast: ['fang', 'bristl', 'howl', 'paw', 'mane', 'snarl', 'tusk', 'lope', 'brawn', 'gnash', 'prowl', 'shag'],
  insect: ['chitt', 'mandi', 'skitter', 'hive', 'weevil', 'nymph', 'thrip', 'carap', 'buzz', 'crawl', 'mite', 'lacew'],
  mind: ['cogit', 'lucid', 'noet', 'ponder', 'psy', 'sooth', 'reveri', 'notion', 'muse', 'quandar', 'idea', 'theor'],
  spirit: ['pallid', 'requi', 'wraith', 'vigil', 'shroud', 'lament', 'relic', 'mourn', 'hollow', 'sepul', 'eul', 'keen'],
  umbra: ['dusk', 'sable', 'umbr', 'nocturn', 'shade', 'gloam', 'veil', 'pitch', 'murmur', 'creep', 'blot', 'stalk'],
  radiant: ['aur', 'lumen', 'halcy', 'gleam', 'prism', 'solar', 'daw', 'beacon', 'candl', 'clarion', 'nimbus', 'sanct'],
  chaos: ['snarl', 'null', 'skew', 'ravel', 'warp', 'jitter', 'disso', 'errat', 'glitch', 'seam', 'lapse', 'unwe'],
};

const SUFFIX = {
  1: ['ling', 'kit', 'let', 'pip', 'mote', 'nib', 'sprout', 'wisp', 'whelp', 'tot', 'bit', 'chip'],
  2: ['mane', 'claw', 'fang', 'wing', 'stride', 'crest', 'hide', 'coil', 'husk', 'gale', 'stalker', 'runner'],
  3: ['lord', 'thane', 'arch', 'king', 'crown', 'wrath', 'mourn', 'sovereign', 'reaver', 'warden', 'colossus', 'herald'],
};

// ── Archetypes ─────────────────────────────────────────────────────────────
// Weights are relative shares of the stat budget.
const ARCHETYPES = {
  bruiser: { w: { hp: 1.05, atk: 1.45, def: 1.2, spa: 0.6, spd: 0.85, spe: 0.85 }, plans: ['quadruped', 'biped', 'draconic'] },
  sweeper: { w: { hp: 0.85, atk: 1.4, def: 0.75, spa: 0.75, spd: 0.8, spe: 1.45 }, plans: ['quadruped', 'biped', 'avian'] },
  cannon: { w: { hp: 0.85, atk: 0.6, def: 0.75, spa: 1.5, spd: 0.95, spe: 1.35 }, plans: ['floater', 'avian', 'amorphous'] },
  wall: { w: { hp: 1.45, atk: 0.7, def: 1.4, spa: 0.8, spd: 1.25, spe: 0.4 }, plans: ['construct', 'plant', 'arachnid'] },
  tank: { w: { hp: 1.35, atk: 1.2, def: 1.3, spa: 0.75, spd: 0.9, spe: 0.5 }, plans: ['quadruped', 'construct', 'arachnid'] },
  support: { w: { hp: 1.2, atk: 0.7, def: 1.05, spa: 1.05, spd: 1.35 , spe: 0.65 }, plans: ['plant', 'floater', 'aquatic'] },
  balanced: { w: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, plans: ['quadruped', 'serpent', 'aquatic', 'insectoid'] },
  glass: { w: { hp: 0.75, atk: 1.25, def: 0.6, spa: 1.35, spd: 0.65, spe: 1.4 }, plans: ['insectoid', 'floater', 'serpent'] },
  trickster: { w: { hp: 0.9, atk: 0.85, def: 0.9, spa: 1.25, spd: 1.1, spe: 1.4 }, plans: ['floater', 'amorphous', 'insectoid'] },
};

const ARCH_KEYS = Object.keys(ARCHETYPES);

// Base stat totals per stage.
const BST = { 1: 305, 2: 415, 3: 520 };
const BST_RARE = { 1: 330, 2: 450, 3: 560 };

// ── Ability pools ──────────────────────────────────────────────────────────
const TYPE_ABILITIES = {
  ember: ['blaze', 'cinderskin', 'kindler', 'magmaheart', 'flamedrink', 'sunsoak'],
  tide: ['torrent', 'waterwell', 'cloudcaller', 'raindrink', 'rainrunner', 'multiscale'],
  verdant: ['overgrow', 'rootfeed', 'photosynth', 'regenerator', 'barbskin', 'leech'],
  volt: ['staticfield', 'conductor', 'quickfoot', 'download', 'rainrunner', 'momentum'],
  frost: ['icebody', 'snowcoat', 'coldblooded', 'snowmaker', 'sturdy', 'marvelhide'],
  gale: ['keeneye', 'slipstream', 'firststrike', 'compound', 'quickfoot', 'stealthstep'],
  stone: ['sturdy', 'duststorm', 'sandveil', 'ironwall', 'thickhide', 'prospector'],
  metal: ['ironwall', 'heavyhitter', 'sturdy', 'filter', 'technician', 'download'],
  toxin: ['toxicskin', 'immunity', 'poisonheal', 'toxicboost', 'shedskin', 'leech'],
  beast: ['guts', 'intimidate', 'bruiser', 'forager', 'thickhide', 'scrapper'],
  insect: ['swarmcall', 'compound', 'shedskin', 'barbskin', 'technician', 'honeylure'],
  mind: ['clearmind', 'prankster', 'unaware', 'download', 'simple', 'mirrorcoat'],
  spirit: ['cursedtouch', 'nightmantle', 'grudge', 'leech', 'stealthstep', 'regenerator'],
  umbra: ['stealthstep', 'shadeeater', 'nightmantle', 'sniper', 'prankster', 'unnerve'],
  radiant: ['prismskin', 'dawnbringer', 'purebody', 'naturalcure', 'multiscale', 'charmer'],
  chaos: ['weavebound', 'contrary', 'unravel', 'glasscannon', 'mirrorarmor', 'lastlaugh'],
};

const ARCH_ABILITIES = {
  bruiser: ['bruiser', 'guts', 'heavyhitter', 'intimidate'],
  sweeper: ['firststrike', 'momentum', 'sniper', 'keeneye'],
  cannon: ['glasscannon', 'technician', 'download', 'adaptive'],
  wall: ['sturdy', 'ironwall', 'multiscale', 'filter'],
  tank: ['thickhide', 'marvelhide', 'stall', 'regenerator'],
  support: ['naturalcure', 'regenerator', 'clearmind', 'shedskin'],
  balanced: ['adaptive', 'technician', 'forager', 'keeneye'],
  glass: ['glasscannon', 'sniper', 'lastember', 'quickfoot'],
  trickster: ['prankster', 'contrary', 'slipstream', 'mirrorarmor'],
};

// ── Flavour banks ──────────────────────────────────────────────────────────
const TYPE_LINES = {
  ember: [
    'It banks its own coals overnight and wakes them at dawn.',
    'Rain hisses off it well before it lands.',
    'It sleeps in chimneys and considers this a favour to the household.',
    'The ground it walks stays warm until evening.',
    'It carries one ember from its birthplace and will not be parted from it.',
  ],
  tide: [
    'It reads the tide two days ahead and is never wrong.',
    'Fresh water makes it sluggish; salt makes it argumentative.',
    'It leaves wet footprints on dry stone hours after passing.',
    'Sailors take its surfacing as a fair-weather sign.',
    'It hums at a pitch that carries a mile underwater.',
  ],
  verdant: [
    'Wherever it naps, something grows the following week.',
    'It roots overnight and complains about being moved.',
    'It counts seasons rather than days.',
    'Its leaves turn to face whoever it trusts most in the room.',
    'It has opinions about soil that it makes known.',
  ],
  volt: [
    'It makes every lamp within ten paces flicker in sympathy.',
    'It charges itself on storm-fronts and coasts for days.',
    'Compasses near it lose their nerve.',
    'It sleeps standing so as not to earth itself.',
    'Static follows it around like a rumour.',
  ],
  frost: [
    'It keeps a pocket of winter about itself in any season.',
    'Its tracks stay frozen long after the thaw.',
    'It breathes out and the room goes quiet.',
    'It grows still rather than cold when it is angry.',
    'Snow settles on it and stays perfectly clean.',
  ],
  gale: [
    'It never lands where it meant to and never seems to mind.',
    'It rides thermals for whole days without a wingbeat.',
    'It steals the first warm draught of the morning.',
    'It navigates by the smell of weather.',
    'It arrives ahead of its own sound.',
  ],
  stone: [
    'It has been mistaken for scenery by three separate surveying teams.',
    'It settles into a place and the place settles around it.',
    'It grinds its own gravel to sleep.',
    'It remembers the shape of the valley before the road.',
    'Weight is a tool to it, not a burden.',
  ],
  metal: [
    'It sharpens itself against anything softer, which is most things.',
    'It rings when struck and takes offence at the sound.',
    'Rust is a personal insult to it.',
    'It oils its own joints with obvious pride.',
    'Smiths keep one around for the company.',
  ],
  toxin: [
    'Nothing that eats it makes that mistake twice.',
    'It thrives in the parts of the marsh nobody surveys.',
    'It is fastidiously clean and entirely poisonous.',
    'Its scent clears a room politely and completely.',
    'It cultivates its own rot with a gardener\'s care.',
  ],
  beast: [
    'It hunts on a schedule and expects the same of its trainer.',
    'It marks its territory in a wide, exhausting circle.',
    'It sleeps against whoever it has decided to keep.',
    'It answers to a whistle, its own, and no other.',
    'It brings back things it thinks you have lost.',
  ],
  insect: [
    'It communicates in a buzz that is nearly a language.',
    'A dozen of them can strip a field in an afternoon.',
    'It moults twice a season and eats the shed shell.',
    'It builds structures with no clear purpose and defends them fiercely.',
    'It follows lantern light with total, fatal commitment.',
  ],
  mind: [
    'It finishes sentences and is usually right.',
    'It rearranges small objects while it thinks.',
    'It dreams loudly enough to be overheard.',
    'It finds the answer first and the question afterwards.',
    'It watches you decide before you know you have.',
  ],
  spirit: [
    'It is waiting for someone who is no longer coming, and it knows.',
    'It keeps a habit from a life it can no longer remember.',
    'Lamps gutter when it passes and steady after.',
    'It cannot cross a threshold it was never invited through.',
    'It holds a small grief very carefully.',
  ],
  umbra: [
    'It stands exactly where you were not looking.',
    'Its shadow arrives slightly before it does.',
    'It prefers the hour after the lamps go out.',
    'It hides things and returns them, eventually, changed.',
    'It is not malicious. It is simply never surprised.',
  ],
  radiant: [
    'It gives off enough light to read by and knows it.',
    'It rises with the sun out of habit rather than need.',
    'Anything it touches keeps a faint warmth for hours.',
    'It refuses to enter a room already lit.',
    'It has no shadow worth the name.',
  ],
  chaos: [
    'It is stitched out of the part of the Weave that came loose.',
    'Two people watching it will disagree about what they saw.',
    'It exists slightly out of step with the rest of the room.',
    'Numbers written near it come out wrong.',
    'It is not broken. It was never finished.',
  ],
};

const ARCH_LINES = {
  bruiser: ['It settles arguments with its shoulder.', 'It has never once stepped back.', 'It fights close and finishes early.'],
  sweeper: ['It is gone before the counterattack arrives.', 'It measures fights in seconds.', 'Speed is the only strategy it respects.'],
  cannon: ['It opens with everything it has.', 'One good hit is its entire plan.', 'It aims for a long time and fires once.'],
  wall: ['It outlasts. That is the whole trick.', 'Nothing has moved it yet.', 'It treats a battle as a waiting problem.'],
  tank: ['It absorbs the first three blows on purpose.', 'It walks through what it cannot dodge.', 'It is heavier than it looks by a margin.'],
  support: ['It keeps the rest of the team standing.', 'It fights by making others harder to beat.', 'It notices who is hurt before they say so.'],
  balanced: ['It has no obvious weakness and no obvious plan.', 'It adapts rather than specialises.', 'It is competent at nearly everything.'],
  glass: ['It hits enormously and folds quickly.', 'Everything it has is on the outside.', 'It cannot afford a second exchange.'],
  trickster: ['It wins fights it should not, and will not explain how.', 'It changes the rules mid-battle.', 'It is having more fun than its opponent.'],
};

// Body plan candidates per type, layered over archetype preference.
const TYPE_PLANS = {
  ember: ['quadruped', 'biped', 'draconic', 'floater'],
  tide: ['aquatic', 'serpent', 'amorphous', 'arachnid'],
  verdant: ['plant', 'quadruped', 'insectoid'],
  volt: ['quadruped', 'floater', 'construct', 'insectoid'],
  frost: ['quadruped', 'avian', 'construct', 'amorphous'],
  gale: ['avian', 'floater', 'serpent'],
  stone: ['construct', 'quadruped', 'arachnid'],
  metal: ['construct', 'arachnid', 'biped'],
  toxin: ['amorphous', 'plant', 'serpent', 'insectoid'],
  beast: ['quadruped', 'biped', 'draconic'],
  insect: ['insectoid', 'arachnid'],
  mind: ['floater', 'biped', 'amorphous'],
  spirit: ['floater', 'amorphous', 'avian'],
  umbra: ['quadruped', 'floater', 'amorphous', 'serpent'],
  radiant: ['avian', 'floater', 'plant'],
  chaos: ['amorphous', 'floater', 'serpent', 'construct'],
};

// Secondary types that read naturally with each primary.
const TYPE_PARTNERS = {
  ember: ['beast', 'stone', 'metal', 'umbra', 'gale', 'chaos'],
  tide: ['frost', 'stone', 'toxin', 'beast', 'spirit', 'insect'],
  verdant: ['toxin', 'insect', 'stone', 'radiant', 'beast', 'frost'],
  volt: ['metal', 'gale', 'tide', 'insect', 'mind', 'chaos'],
  frost: ['gale', 'stone', 'tide', 'spirit', 'metal', 'beast'],
  gale: ['beast', 'insect', 'radiant', 'volt', 'spirit', 'mind'],
  stone: ['metal', 'beast', 'toxin', 'ember', 'insect', 'spirit'],
  metal: ['stone', 'volt', 'mind', 'ember', 'insect', 'chaos'],
  toxin: ['insect', 'verdant', 'umbra', 'tide', 'spirit', 'stone'],
  beast: ['stone', 'gale', 'frost', 'ember', 'umbra', 'insect'],
  insect: ['toxin', 'verdant', 'gale', 'metal', 'umbra', 'radiant'],
  mind: ['spirit', 'radiant', 'umbra', 'chaos', 'gale', 'volt'],
  spirit: ['umbra', 'mind', 'frost', 'toxin', 'radiant', 'chaos'],
  umbra: ['spirit', 'beast', 'toxin', 'mind', 'metal', 'chaos'],
  radiant: ['mind', 'gale', 'verdant', 'metal', 'spirit', 'ember'],
  chaos: ['umbra', 'mind', 'spirit', 'metal', 'volt', 'stone'],
};

// Where each type is likely to live; encounter tables read these tags.
const TYPE_HABITATS = {
  ember: ['volcano', 'forge', 'grass_mid'],
  tide: ['coast', 'harbor', 'deep', 'river'],
  verdant: ['forest', 'grass_early', 'heartwood'],
  volt: ['stormcoast', 'facility', 'grass_mid'],
  frost: ['tundra', 'peaks'],
  gale: ['peaks', 'grass_early', 'stormcoast'],
  stone: ['quarry', 'cave', 'desert'],
  metal: ['forge', 'facility', 'quarry'],
  toxin: ['marsh', 'sewer', 'cave'],
  beast: ['grass_early', 'grass_mid', 'forest'],
  insect: ['forest', 'marsh', 'grass_early'],
  mind: ['academy', 'ruins', 'library'],
  spirit: ['graveyard', 'ruins', 'deepdark'],
  umbra: ['deepdark', 'ruins', 'sewer'],
  radiant: ['summit', 'academy', 'coast'],
  chaos: ['rift', 'ruins'],
};

const RARITY_BY_STAGE = { 1: 'common', 2: 'uncommon', 3: 'rare' };

/** Builds a display name that has not been used yet. */
function makeName(rng, type, stage, used) {
  const stems = STEMS[type];
  for (let attempt = 0; attempt < 60; attempt++) {
    const stem = rng.pick(stems);
    const suffix = rng.pick(SUFFIX[stage]);
    // Collapse a doubled letter at the seam: "thorn"+"nib" → "thornib".
    const seamed = stem.endsWith(suffix[0]) ? stem + suffix.slice(1) : stem + suffix;
    let name = seamed.replace(/([aeiou])\1/g, '$1');
    name = name[0].toUpperCase() + name.slice(1);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  let n = 2;
  let base = rng.pick(stems);
  base = base[0].toUpperCase() + base.slice(1) + rng.pick(SUFFIX[stage]);
  while (used.has(base + n)) n++;
  used.add(base + n);
  return base + n;
}

/** Distributes a stat budget over the six stats using archetype weights. */
function makeStats(rng, archetype, total) {
  const w = ARCHETYPES[archetype].w;
  let sum = 0;
  const jitter = {};
  for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    jitter[k] = w[k] * rng.float(0.9, 1.1);
    sum += jitter[k];
  }
  const out = [];
  for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    out.push(Math.max(20, Math.round((jitter[k] / sum) * total)));
  }
  return out;
}

function pickPlan(rng, type, archetype) {
  const typePlans = TYPE_PLANS[type];
  const archPlans = ARCHETYPES[archetype].plans;
  const shared = typePlans.filter((p) => archPlans.includes(p));
  return rng.pick(shared.length ? shared : typePlans);
}

function pickAbilities(rng, type, archetype, used) {
  const pool = [...TYPE_ABILITIES[type], ...ARCH_ABILITIES[archetype]];
  const chosen = rng.sample(pool, 3);
  const ab = [chosen[0]];
  if (rng.percent(55) && chosen[1] && chosen[1] !== chosen[0]) ab.push(chosen[1]);
  const ha = chosen[2] && !ab.includes(chosen[2]) ? chosen[2] : null;
  used.add(ab[0]);
  return { ab, ha };
}

function makeDex(rng, type, archetype, usedLines) {
  const typeLines = TYPE_LINES[type];
  const archLines = ARCH_LINES[archetype];
  for (let i = 0; i < 20; i++) {
    const a = rng.pick(typeLines);
    const b = rng.pick(archLines);
    const key = a + b;
    if (!usedLines.has(key)) {
      usedLines.add(key);
      return `${a} ${b}`;
    }
  }
  return `${rng.pick(typeLines)} ${rng.pick(archLines)}`;
}

/** Evolution requirement for a child at a given stage. */
function makeRequirement(rng, stage, branchIndex, branchCount) {
  const level = stage === 2 ? rng.int(14, 24) : rng.int(30, 42);
  if (branchCount === 1) {
    if (stage === 3 && rng.percent(18)) {
      return { item: rng.pick(['dawn_stone', 'dusk_stone', 'tide_stone', 'flame_shard', 'storm_shard', 'moss_stone', 'frost_shard', 'iron_core']) };
    }
    if (stage === 3 && rng.percent(12)) return { friendship: 200 };
    return { lv: level };
  }
  // Branching pairs get contrasting conditions so both routes are reachable.
  const modes = rng.pick(['time', 'stat', 'item']);
  if (modes === 'time') return { lv: level, cond: branchIndex === 0 ? 'day' : 'night' };
  if (modes === 'stat') return { lv: level, cond: branchIndex === 0 ? 'atk>=spa' : 'spa>atk' };
  return branchIndex === 0
    ? { lv: level }
    : { item: rng.pick(['dawn_stone', 'dusk_stone', 'tide_stone', 'flame_shard', 'storm_shard', 'moss_stone', 'frost_shard', 'iron_core']) };
}

/** Builds one node and, recursively, its evolutions. */
function buildNode(rng, ctx, stage, opts) {
  const { usedNames, usedLines } = ctx;
  const type = opts.type;
  const archetype = opts.archetype;
  const rare = opts.rare;

  const types = [type];
  if (stage >= opts.dualFrom) {
    const partner = opts.partner;
    if (partner && partner !== type) types.push(partner);
  }

  const budget = (rare ? BST_RARE : BST)[stage] + rng.int(-12, 12);
  const { ab, ha } = pickAbilities(rng, type, archetype, ctx.usedAbilities);

  const node = {
    n: makeName(rng, type, stage, usedNames),
    t: types,
    plan: opts.plan,
    b: makeStats(rng, archetype, budget),
    ab,
    ha,
    dex: makeDex(rng, type, archetype, usedLines),
  };

  if (stage < opts.stages) {
    const branchCount = stage === opts.stages - 1 && opts.branches > 1 ? opts.branches : 1;
    node.evo = [];
    for (let i = 0; i < branchCount; i++) {
      // Branch siblings drift toward different archetypes so the choice matters.
      const childArch = branchCount > 1 && i > 0 ? ctx.rng.pick(ARCH_KEYS) : archetype;
      const childPartner =
        branchCount > 1 && i > 0 ? rng.pick(TYPE_PARTNERS[type]) : opts.partner;
      const child = buildNode(rng, ctx, stage + 1, {
        ...opts,
        archetype: childArch,
        partner: childPartner,
        plan: branchCount > 1 && i > 0 ? pickPlan(rng, type, childArch) : opts.plan,
      });
      child.req = makeRequirement(rng, stage + 1, i, branchCount);
      node.evo.push(child);
    }
  }
  return node;
}

/**
 * Generates the procedural half of the roster.
 * @param {number} familiesPerType how many families to build for each type
 */
export function generateFamilies(familiesPerType = 6, seed = 0x5eed1) {
  const rng = new RNG(seed);
  const ctx = {
    rng,
    usedNames: new Set(),
    usedLines: new Set(),
    usedAbilities: new Set(),
  };
  const families = [];

  const TYPES = Object.keys(STEMS);
  for (const type of TYPES) {
    for (let i = 0; i < familiesPerType; i++) {
      const famRng = rngFromString(`${type}:${i}:${seed}`);
      // Mix the family RNG into the shared one so names stay globally unique
      // while each family's shape is stable on its own seed.
      const archetype = famRng.pick(ARCH_KEYS);
      const stages = famRng.weighted([1, 2, 3], [0.14, 0.4, 0.46]);
      const branches = stages === 3 && famRng.percent(34) ? 2 : 1;
      const rare = famRng.percent(14);
      const plan = pickPlan(famRng, type, archetype);
      const partner = famRng.pick(TYPE_PARTNERS[type]);
      const dualFrom = famRng.weighted([1, 2, 3, 99], [0.16, 0.3, 0.28, 0.26]);

      const root = buildNode(rng, ctx, 1, {
        type,
        archetype,
        stages,
        branches,
        rare,
        plan,
        partner,
        dualFrom,
      });

      families.push({
        id: `gen_${type}_${i}`,
        rarity: rare ? 'rare' : RARITY_BY_STAGE[stages],
        habitat: rng.sample(TYPE_HABITATS[type], Math.min(2, TYPE_HABITATS[type].length)),
        generated: true,
        root,
      });
    }
  }
  return families;
}

export { ARCHETYPES, TYPE_HABITATS };
