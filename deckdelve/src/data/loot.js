// Treasure. The gold is the score; the named pieces are the stories people tell
// afterwards in the guild hall, usually inaccurately.

export const GRADES = {
  petty: { gold: [8, 22], gearChance: 0.12, gradeRoll: ['petty', 'petty', 'common'] },
  common: { gold: [24, 60], gearChance: 0.28, gradeRoll: ['petty', 'common', 'common', 'fine'] },
  fine: { gold: [65, 150], gearChance: 0.5, gradeRoll: ['common', 'fine', 'fine', 'superb'] },
  superb: { gold: [180, 380], gearChance: 0.85, gradeRoll: ['fine', 'fine', 'superb', 'superb'] },
};

export const TREASURE_NAMES = {
  petty: [
    'a fistful of sticky copper',
    'a purse with three coins and a tooth in it',
    'a candlestick, slightly chewed',
    'nine identical keys',
    'a sack of surprisingly good nails',
    'a bottle of something brown and confident',
  ],
  common: [
    'a strongbox of old crown-marks',
    'a silver service missing one spoon',
    'a bag of uncut river stones',
    'a merchant ledger, heavily and creatively falsified',
    'a jar of teeth, sorted by owner',
    'a folded map of a place that no longer exists',
  ],
  fine: [
    'a chest of minted gold, still banded',
    'a reliquary with someone important inside',
    'a strand of black pearls, warm to the touch',
    'a crown, bent, with a note of apology inside it',
    'a sealed decanter that hums when carried',
    'a codex nobody in the guild can read',
  ],
  superb: [
    "a dragon's paywall — bar upon bar of stamped gold",
    'the Vault Ledger itself, worth more than what it lists',
    'a sapphire the size of a closed fist',
    'the deed to this entire dungeon, filed and witnessed',
    'a heart of amber with something still beating in it',
  ],
};

/** Flavour for the moment a chest opens badly. */
export const BAD_NEWS = [
  'It was a chest. It is now a problem.',
  'The lock was a formality. The teeth were not.',
  'Something in the coin is looking back.',
  'The lid closes on a hand. The hand is retrieved.',
];
