// Personality traits. Each one is a real modifier on the autonomous AI, not
// flavour text — a Coward genuinely leaves early, and a Greedy rogue genuinely
// walks into the chest room alone.

export const TRAITS = {
  greedy: {
    id: 'greedy',
    name: 'Greedy',
    lootPriority: 2.2,
    fleeThreshold: -0.08,
    cohesion: 0.6,
    goldBonus: 0.2,
    blurb: 'Hears coin through stone. Will not be reasoned with.',
  },
  coward: {
    id: 'coward',
    name: 'Coward',
    fleeThreshold: 0.18,
    cohesion: 1.4,
    speedBonus: 0.08,
    blurb: 'Leaves early and lives long. Mostly.',
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    featurePriority: 2.0,
    arcaneAffinity: 1,
    xpBonus: 0.15,
    blurb: 'Will read the cursed book. Has read worse.',
  },
  reckless: {
    id: 'reckless',
    name: 'Reckless',
    chargeBias: 2.0,
    fleeThreshold: -0.15,
    cohesion: 0.45,
    damageBonus: 0.12,
    blurb: 'Sees a door, opens the door, regrets the door.',
  },
  loyal: {
    id: 'loyal',
    name: 'Loyal',
    guardAllies: 1,
    cohesion: 1.5,
    fleeThreshold: -0.05,
    blurb: 'Will stand over a body that is still warm.',
  },
  cautious: {
    id: 'cautious',
    name: 'Cautious',
    waitForParty: 1,
    fleeThreshold: 0.08,
    armorBonus: 1,
    blurb: 'Checks the room twice. It has paid off twice.',
  },
  superstitious: {
    id: 'superstitious',
    name: 'Superstitious',
    shrinePriority: 2.5,
    undeadDread: 1,
    blurb: 'Prays at every shrine, salts every threshold, dreads every crypt.',
  },
  glutton: {
    id: 'glutton',
    name: 'Glutton',
    restBonus: 0.8,
    campPriority: 1.8,
    hpBonus: 0.1,
    blurb: 'Always hungry, always heavier, always somehow still standing.',
  },
  lucky: {
    id: 'lucky',
    name: 'Lucky',
    critBonus: 0.1,
    lootGrade: 1,
    dodgeBonus: 0.06,
    blurb: 'Has fallen down three shafts and landed on something soft each time.',
  },
  kleptomaniac: {
    id: 'kleptomaniac',
    name: 'Kleptomaniac',
    lootPriority: 1.8,
    lootSpeed: 1.6,
    trapRisk: 0.35,
    blurb: 'Pockets first, identifies later, apologises never.',
  },
  stoic: {
    id: 'stoic',
    name: 'Stoic',
    statusResist: 0.4,
    fleeThreshold: -0.1,
    blurb: 'Has been on fire before. Did not care for it, but managed.',
  },
  claustrophobic: {
    id: 'claustrophobic',
    name: 'Claustrophobic',
    depthDread: 1,
    speedBonus: 0.05,
    blurb: 'Counts the rooms back to daylight. Out loud. Constantly.',
  },
  vainglorious: {
    id: 'vainglorious',
    name: 'Vainglorious',
    bossBias: 1.6,
    damageBonus: 0.15,
    fleeThreshold: -0.06,
    blurb: 'Wants the story more than the money. Will get one or the other.',
  },
  veteran: {
    id: 'veteran',
    name: 'Veteran',
    locked: true,
    damageBonus: 0.1,
    armorBonus: 2,
    statusResist: 0.25,
    blurb: 'Earned the hard way: survive three expeditions and this arrives on its own.',
  },
};

export const TRAIT_LIST = Object.values(TRAITS);
export const ROLLABLE_TRAITS = TRAIT_LIST.filter((t) => !t.locked);

export function getTrait(id) {
  const t = TRAITS[id];
  if (!t) throw new Error(`unknown trait: ${id}`);
  return t;
}

/** Sums one numeric field across a set of trait ids. */
export function traitSum(traitIds, field) {
  let total = 0;
  for (const id of traitIds || []) {
    const t = TRAITS[id];
    if (t && typeof t[field] === 'number') total += t[field];
  }
  return total;
}

export function hasTrait(traitIds, id) {
  return !!(traitIds || []).includes(id);
}
