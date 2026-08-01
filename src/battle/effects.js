// Status conditions, weather, hazards and screens: the data tables plus the
// small pure helpers the engine uses. Anything that needs to touch battle
// state lives in engine.js.

export const STATUSES = {
  burn: {
    name: 'burned',
    short: 'BRN',
    color: '#ef6b3a',
    residual: 1 / 16,
    message: (n) => `${n} is burned!`,
    tick: (n) => `${n} is hurt by its burn.`,
  },
  poison: {
    name: 'poisoned',
    short: 'PSN',
    color: '#a967c9',
    residual: 1 / 8,
    message: (n) => `${n} is poisoned!`,
    tick: (n) => `${n} is hurt by poison.`,
  },
  toxic: {
    name: 'badly poisoned',
    short: 'TOX',
    color: '#7d3d99',
    residual: 1 / 16, // multiplied by the turn counter
    escalating: true,
    message: (n) => `${n} is badly poisoned!`,
    tick: (n) => `${n} is racked by poison.`,
  },
  paralysis: {
    name: 'paralysed',
    short: 'PAR',
    color: '#e7c33c',
    skipChance: 25,
    speedMult: 0.5,
    message: (n) => `${n} is paralysed! It may not move.`,
    tick: null,
  },
  sleep: {
    name: 'asleep',
    short: 'SLP',
    color: '#8f8ce0',
    blocksAction: true,
    duration: [1, 3],
    message: (n) => `${n} falls asleep!`,
    tick: (n) => `${n} is fast asleep.`,
  },
  freeze: {
    name: 'frozen',
    short: 'FRZ',
    color: '#7fd6e0',
    blocksAction: true,
    thawChance: 20,
    message: (n) => `${n} is frozen solid!`,
    tick: (n) => `${n} is frozen solid.`,
  },
  fray: {
    name: 'frayed',
    short: 'FRY',
    color: '#d9534f',
    residual: 1 / 8,
    healPenalty: 0.5,
    message: (n) => `${n} begins to fray at the edges!`,
    tick: (n) => `${n} unravels a little more.`,
  },
};

/** Statuses that only last within a battle live on `mon.volatiles`. */
export const VOLATILES = {
  confusion: { name: 'confused', duration: [2, 4], selfHitChance: 33, selfHitPower: 40 },
  flinch: { name: 'flinching', duration: [1, 1] },
  trap: { name: 'trapped', duration: [4, 5], residual: 1 / 8 },
  seed: { name: 'seeded', drain: 1 / 8 },
  taunt: { name: 'taunted', duration: [3, 3] },
  protect: { name: 'protected', duration: [1, 1] },
  charging: { name: 'charging', duration: [1, 1] },
  recharge: { name: 'recharging', duration: [1, 1] },
};

export const WEATHERS = {
  sun: {
    name: 'Harsh sunlight',
    start: 'The sunlight turns harsh!',
    ongoing: 'The sunlight is harsh.',
    end: 'The sunlight fades.',
    boost: { ember: 1.5, tide: 0.5 },
  },
  rain: {
    name: 'Rain',
    start: 'Rain begins to fall!',
    ongoing: 'Rain keeps falling.',
    end: 'The rain stops.',
    boost: { tide: 1.5, ember: 0.5 },
  },
  sand: {
    name: 'Sandstorm',
    start: 'A sandstorm kicks up!',
    ongoing: 'The sandstorm rages.',
    end: 'The sandstorm subsides.',
    chip: 1 / 16,
    chipImmune: ['stone', 'metal', 'insect'],
    spdBoost: ['stone'],
  },
  hail: {
    name: 'Hail',
    start: 'Hail starts to fall!',
    ongoing: 'Hail pelts the field.',
    end: 'The hail stops.',
    chip: 1 / 16,
    chipImmune: ['frost'],
    defBoost: ['frost'],
  },
};

export const TERRAINS = {
  frayed: {
    name: 'Frayed Weave',
    start: 'The Weave frays underfoot!',
    end: 'The Weave settles.',
    boost: { chaos: 1.4, spirit: 1.2 },
    // Everything on a frayed field takes a little chip damage.
    chip: 1 / 20,
  },
};

export const HAZARDS = {
  thorns: {
    name: 'thorns',
    start: 'Thorns spread across the ground!',
    damage: (mon) => Math.floor(mon.stats.hp / 8),
    message: (n) => `${n} is pricked by thorns!`,
    grounded: true,
    maxLayers: 1,
  },
  shards: {
    name: 'stone shards',
    start: 'Sharp stone scatters across the field!',
    // Scales with how badly the entrant resists Stone.
    typed: 'stone',
    damage: (mon, mult) => Math.floor((mon.stats.hp / 8) * mult),
    message: (n) => `${n} is cut by stone shards!`,
    maxLayers: 1,
  },
  caltrops: {
    name: 'caltrops',
    start: 'Caltrops litter the ground!',
    damage: (mon, _m, layers) => Math.floor(mon.stats.hp / (layers === 1 ? 8 : layers === 2 ? 6 : 4)),
    message: (n) => `${n} steps on caltrops!`,
    grounded: true,
    maxLayers: 3,
  },
  miasma: {
    name: 'miasma',
    start: 'Poison fog rolls in!',
    status: 'poison',
    message: (n) => `${n} breathes in the miasma!`,
    grounded: true,
    maxLayers: 1,
  },
};

export const SCREENS = {
  reflect: { name: 'Barrier', turns: 5, physicalMult: 0.5, start: 'A barrier goes up!', end: 'The barrier fades.' },
  lightscreen: { name: 'Light Screen', turns: 5, specialMult: 0.5, start: 'A screen of light forms!', end: 'The light screen fades.' },
  sanctuary: { name: 'Sanctuary', turns: 5, blocksStatus: true, start: 'A calm settles over the party.', end: 'The calm lifts.' },
};

/** Stat stage multiplier table, -6..+6. */
export function stageMultiplier(stage) {
  if (stage >= 0) return (2 + stage) / 2;
  return 2 / (2 - stage);
}

/** Accuracy/evasion use a gentler curve. */
export function accuracyStageMultiplier(stage) {
  if (stage >= 0) return (3 + stage) / 3;
  return 3 / (3 - stage);
}

export function critChanceForStage(stage) {
  const table = [1 / 24, 1 / 8, 1 / 2, 1, 1];
  return table[Math.min(stage, table.length - 1)];
}

export function statusShort(status) {
  return STATUSES[status] ? STATUSES[status].short : '';
}

export function statusColor(status) {
  return STATUSES[status] ? STATUSES[status].color : '#888';
}

/** Types that cannot receive a given status at all. */
export const STATUS_IMMUNE_TYPES = {
  burn: ['ember'],
  freeze: ['frost'],
  poison: ['toxin', 'metal'],
  toxic: ['toxin', 'metal'],
  paralysis: ['volt'],
  fray: ['chaos'],
};
