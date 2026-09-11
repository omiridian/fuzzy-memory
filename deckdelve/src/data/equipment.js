// Basic gear. Three slots, four grades, one rule: better numbers, better name.

export const SLOTS = ['weapon', 'armor', 'trinket'];

export const GEAR = [
  // weapons
  { id: 'notched_sword', name: 'Notched Sword', slot: 'weapon', grade: 'petty', damage: 2, for: ['fighter'] },
  { id: 'guild_blade', name: 'Guild Blade', slot: 'weapon', grade: 'common', damage: 4, for: ['fighter', 'rogue'] },
  { id: 'boarding_axe', name: 'Boarding Axe', slot: 'weapon', grade: 'fine', damage: 7, attackTime: 0.08, for: ['fighter'] },
  { id: 'kingmaker', name: 'Kingmaker', slot: 'weapon', grade: 'superb', damage: 12, crit: 0.06, for: ['fighter'] },
  { id: 'bent_dagger', name: 'Bent Dagger', slot: 'weapon', grade: 'petty', damage: 1, crit: 0.03, for: ['rogue'] },
  { id: 'whisper_knife', name: 'Whisper Knife', slot: 'weapon', grade: 'fine', damage: 4, crit: 0.1, for: ['rogue'] },
  { id: 'liar_fang', name: "Liar's Fang", slot: 'weapon', grade: 'superb', damage: 7, crit: 0.16, for: ['rogue'] },
  { id: 'chalk_wand', name: 'Chalk Wand', slot: 'weapon', grade: 'petty', damage: 2, for: ['mage'] },
  { id: 'stormglass_rod', name: 'Stormglass Rod', slot: 'weapon', grade: 'fine', damage: 7, attackTime: 0.12, for: ['mage'] },
  { id: 'first_word', name: 'The First Word', slot: 'weapon', grade: 'superb', damage: 13, attackTime: 0.2, for: ['mage'] },
  { id: 'oak_censer', name: 'Oak Censer', slot: 'weapon', grade: 'common', damage: 3, healBonus: 4, for: ['cleric'] },
  { id: 'bell_of_hours', name: 'Bell of Hours', slot: 'weapon', grade: 'superb', damage: 6, healBonus: 12, for: ['cleric'] },
  { id: 'horn_bow', name: 'Horn Bow', slot: 'weapon', grade: 'common', damage: 4, for: ['ranger'] },
  { id: 'long_quiet', name: 'The Long Quiet', slot: 'weapon', grade: 'superb', damage: 10, crit: 0.08, for: ['ranger'] },

  // armor
  { id: 'padded_coat', name: 'Padded Coat', slot: 'armor', grade: 'petty', armor: 1, hp: 6 },
  { id: 'guild_mail', name: 'Guild Mail', slot: 'armor', grade: 'common', armor: 3, hp: 12 },
  { id: 'gravewarden_plate', name: 'Gravewarden Plate', slot: 'armor', grade: 'fine', armor: 6, hp: 22, speed: -4 },
  { id: 'coat_of_small_hours', name: 'Coat of Small Hours', slot: 'armor', grade: 'fine', armor: 3, hp: 14, speed: 6 },
  { id: 'dragonscale_wrap', name: 'Dragonscale Wrap', slot: 'armor', grade: 'superb', armor: 9, hp: 34, fireResist: 0.4 },

  // trinkets
  { id: 'lucky_tooth', name: 'Lucky Tooth', slot: 'trinket', grade: 'petty', crit: 0.03 },
  { id: 'thief_charm', name: "Thief's Charm", slot: 'trinket', grade: 'common', goldBonus: 0.18 },
  { id: 'saints_thumb', name: "The Saint's Thumb", slot: 'trinket', grade: 'fine', statusResist: 0.3, hp: 10 },
  { id: 'ember_locket', name: 'Ember Locket', slot: 'trinket', grade: 'fine', fireResist: 0.35, damage: 2 },
  { id: 'compass_of_out', name: 'Compass of Out', slot: 'trinket', grade: 'fine', speed: 8, fleeThreshold: -0.05 },
  { id: 'cindervex_eye', name: "Cindervex's Eye", slot: 'trinket', grade: 'superb', damage: 5, crit: 0.08, fireResist: 0.5 },
];

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export const GRADE_ORDER = ['petty', 'common', 'fine', 'superb'];

export const GRADE_COLOR = {
  petty: '#9aa0a6',
  common: '#9fd08a',
  fine: '#6fb8f0',
  superb: '#e8b64c',
};

export const GRADE_VALUE = { petty: 14, common: 40, fine: 110, superb: 320 };

export function getGear(id) {
  const g = GEAR_BY_ID[id];
  if (!g) throw new Error(`unknown gear: ${id}`);
  return g;
}

/**
 * Everything at or below `grade`. Pass a class id to narrow it to what that
 * class can actually hold; pass nothing for the whole catalogue, which is what
 * a chest in the dark contains.
 */
export function gearFor(classId, grade) {
  const cap = GRADE_ORDER.indexOf(grade);
  return GEAR.filter((g) => {
    if (GRADE_ORDER.indexOf(g.grade) > cap) return false;
    if (classId && g.for && !g.for.includes(classId)) return false;
    return true;
  });
}

/** Sums one field across an equipped set, e.g. total bonus damage. */
export function gearSum(equipment, field) {
  let total = 0;
  for (const slot of SLOTS) {
    const id = equipment && equipment[slot];
    const g = id && GEAR_BY_ID[id];
    if (g && typeof g[field] === 'number') total += g[field];
  }
  return total;
}
