// Natures nudge two stats by ±10%. Twenty-five of them, five neutral.

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_NAMES = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
};

export const STAT_SHORT = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spa: 'SPA',
  spd: 'SPD',
  spe: 'SPE',
};

const RAISE = ['atk', 'def', 'spa', 'spd', 'spe'];

const NATURE_NAMES = [
  ['Hardy', 'Lonely', 'Adamant', 'Naughty', 'Brave'],
  ['Bold', 'Docile', 'Impish', 'Lax', 'Relaxed'],
  ['Modest', 'Mild', 'Bashful', 'Rash', 'Quiet'],
  ['Calm', 'Gentle', 'Careful', 'Quirky', 'Sassy'],
  ['Timid', 'Hasty', 'Jolly', 'Naive', 'Serious'],
];

// Flavour, purely for the summary screen.
const NATURE_FLAVOUR = {
  Hardy: 'takes things as they come',
  Lonely: 'keeps its own counsel',
  Adamant: 'refuses to back down',
  Naughty: 'enjoys a little mischief',
  Brave: 'walks into the dark first',
  Bold: 'stands where it is needed',
  Docile: 'is easy company',
  Impish: 'hides your things for fun',
  Lax: 'naps through alarms',
  Relaxed: 'is never in a hurry',
  Modest: 'downplays its own strength',
  Mild: 'rarely raises its voice',
  Bashful: 'hides behind your legs',
  Rash: 'acts before thinking',
  Quiet: 'says everything with a look',
  Calm: 'steadies the whole party',
  Gentle: 'is careful with small things',
  Careful: 'checks the room twice',
  Quirky: 'has habits nobody follows',
  Sassy: 'has opinions about your choices',
  Timid: 'startles at loud noises',
  Hasty: 'is always three steps ahead',
  Jolly: 'makes camp feel warmer',
  Naive: 'trusts absolutely everyone',
  Serious: 'treats every battle as work',
};

export const NATURES = {};

for (let up = 0; up < 5; up++) {
  for (let down = 0; down < 5; down++) {
    const name = NATURE_NAMES[up][down];
    NATURES[name] = {
      name,
      up: up === down ? null : RAISE[up],
      down: up === down ? null : RAISE[down],
      flavour: NATURE_FLAVOUR[name],
    };
  }
}

export const NATURE_LIST = Object.keys(NATURES);

/** Multiplier a nature applies to one stat. */
export function natureMultiplier(natureName, stat) {
  const nature = NATURES[natureName];
  if (!nature || !nature.up) return 1;
  if (nature.up === stat) return 1.1;
  if (nature.down === stat) return 0.9;
  return 1;
}

/** "+Attack / -Sp. Atk" for the summary screen. */
export function natureSummary(natureName) {
  const nature = NATURES[natureName];
  if (!nature || !nature.up) return 'balanced';
  return `+${STAT_SHORT[nature.up]} / -${STAT_SHORT[nature.down]}`;
}
