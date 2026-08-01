// The elemental wheel. Sixteen types, each with a colour used both by the UI
// and by the procedural sprite painter.

export const TYPES = [
  'ember',
  'tide',
  'verdant',
  'volt',
  'frost',
  'gale',
  'stone',
  'metal',
  'toxin',
  'beast',
  'insect',
  'mind',
  'spirit',
  'umbra',
  'radiant',
  'chaos',
];

export const TYPE_INFO = {
  ember: { name: 'Ember', color: '#ef6b3a', dark: '#8a2f13', blurb: 'Living flame and forge-heat.' },
  tide: { name: 'Tide', color: '#3f8fd8', dark: '#17436e', blurb: 'Rivers, rain and the deep.' },
  verdant: { name: 'Verdant', color: '#57b05a', dark: '#1f5426', blurb: 'Root, leaf and slow patience.' },
  volt: { name: 'Volt', color: '#e7c33c', dark: '#8a6b0d', blurb: 'Stormfall and quick current.' },
  frost: { name: 'Frost', color: '#7fd6e0', dark: '#26707c', blurb: 'Rime, hush and long winter.' },
  gale: { name: 'Gale', color: '#9fc4e8', dark: '#41678a', blurb: 'Open sky and cutting wind.' },
  stone: { name: 'Stone', color: '#b08a52', dark: '#5d4321', blurb: 'Bedrock and buried things.' },
  metal: { name: 'Metal', color: '#a9b3c1', dark: '#4c5563', blurb: 'Alloy, edge and endurance.' },
  toxin: { name: 'Toxin', color: '#a967c9', dark: '#552a6b', blurb: 'Spore, venom and rot.' },
  beast: { name: 'Beast', color: '#c98c5a', dark: '#6b452a', blurb: 'Tooth, claw and instinct.' },
  insect: { name: 'Insect', color: '#9cb83e', dark: '#4d5d18', blurb: 'Chitin, swarm and hunger.' },
  mind: { name: 'Mind', color: '#e0729c', dark: '#7a2c4a', blurb: 'Thought turned outward.' },
  spirit: { name: 'Spirit', color: '#8f8ce0', dark: '#3e3c78', blurb: 'Memory that refuses to leave.' },
  umbra: { name: 'Umbra', color: '#6b6f86', dark: '#2b2d3d', blurb: 'The shape a shadow keeps.' },
  radiant: { name: 'Radiant', color: '#f2e2a0', dark: '#9a8535', blurb: 'Dawnlight given weight.' },
  chaos: { name: 'Chaos', color: '#d9534f', dark: '#6e2320', blurb: 'The Weave, frayed and singing.' },
};

// effectiveness[attacker][defender] — 0 immune, 0.5 resisted, 1 neutral, 2 weak.
// Anything unlisted is 1. Written as a sparse table for readability.
const CHART = {
  ember: { verdant: 2, insect: 2, metal: 2, frost: 2, ember: 0.5, tide: 0.5, stone: 0.5, chaos: 0.5 },
  tide: { ember: 2, stone: 2, beast: 2, tide: 0.5, verdant: 0.5, volt: 0.5, chaos: 0.5 },
  verdant: { tide: 2, stone: 2, radiant: 0.5, verdant: 0.5, ember: 0.5, toxin: 0.5, gale: 0.5, insect: 0.5, metal: 0.5 },
  volt: { tide: 2, gale: 2, metal: 2, verdant: 0.5, volt: 0.5, stone: 0, chaos: 0.5 },
  frost: { verdant: 2, gale: 2, beast: 2, stone: 2, ember: 0.5, tide: 0.5, frost: 0.5, metal: 0.5 },
  gale: { insect: 2, verdant: 2, beast: 2, volt: 0.5, stone: 0.5, metal: 0.5, frost: 0.5 },
  stone: { ember: 2, gale: 2, insect: 2, frost: 2, verdant: 0.5, metal: 0.5, beast: 0.5 },
  metal: { frost: 2, stone: 2, radiant: 2, ember: 0.5, tide: 0.5, volt: 0.5, metal: 0.5 },
  toxin: { verdant: 2, radiant: 2, beast: 2, toxin: 0.5, stone: 0.5, spirit: 0.5, metal: 0 },
  beast: { frost: 2, umbra: 2, stone: 2, chaos: 2, insect: 0.5, mind: 0.5, gale: 0.5, spirit: 0 },
  insect: { mind: 2, verdant: 2, umbra: 2, ember: 0.5, gale: 0.5, metal: 0.5, radiant: 0.5, beast: 0.5 },
  mind: { toxin: 2, beast: 2, spirit: 2, mind: 0.5, metal: 0.5, umbra: 0 },
  spirit: { mind: 2, spirit: 2, umbra: 2, beast: 0, radiant: 0.5 },
  umbra: { mind: 2, spirit: 2, radiant: 0.5, beast: 0.5, umbra: 0.5, chaos: 2 },
  radiant: { umbra: 2, chaos: 2, spirit: 2, ember: 0.5, metal: 0.5, verdant: 0.5, radiant: 0.5 },
  chaos: { mind: 2, chaos: 2, radiant: 0.5, metal: 0.5, beast: 0.5 },
};

/** Multiplier for a single attacking type against a single defending type. */
export function typeMultiplier(attackType, defenseType) {
  const row = CHART[attackType];
  if (!row) return 1;
  const v = row[defenseType];
  return v === undefined ? 1 : v;
}

/** Multiplier against a defender's full (1 or 2) type line-up. */
export function effectiveness(attackType, defenderTypes) {
  let mult = 1;
  for (const t of defenderTypes) mult *= typeMultiplier(attackType, t);
  return mult;
}

/** Flavour line the battle log prints after a hit. */
export function effectivenessMessage(mult) {
  if (mult === 0) return "It has no effect...";
  if (mult >= 4) return "It's devastatingly effective!";
  if (mult > 1) return "It's super effective!";
  if (mult > 0 && mult <= 0.25) return "It barely scratches...";
  if (mult < 1) return "It's not very effective...";
  return null;
}

/** Same-Type Attack Bonus. */
export function stab(moveType, userTypes) {
  return userTypes.includes(moveType) ? 1.5 : 1;
}

/** Defensive profile of a type combination — used by the dex UI. */
export function defensiveChart(defenderTypes) {
  const out = {};
  for (const atk of TYPES) out[atk] = effectiveness(atk, defenderTypes);
  return out;
}

export const typeColor = (t) => (TYPE_INFO[t] ? TYPE_INFO[t].color : '#888');
export const typeName = (t) => (TYPE_INFO[t] ? TYPE_INFO[t].name : t);
