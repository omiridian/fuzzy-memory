// Room events. These fire the first time somebody walks in, and they are the
// reason placing a card and watching is more interesting than placing a card.

export const EVENTS = {
  library_whisper: {
    id: 'library_whisper',
    name: 'Something Reads Back',
    text: '{who} opens a book and the book, politely, opens {who}.',
    outcomes: [
      { weight: 3, text: 'It is a treatise on doors. {who} learns three things and forgets one.', xp: 25 },
      { weight: 2, text: 'The margins are full of somebody else’s panic. Useful panic.', reveal: 1 },
      { weight: 2, text: 'The book bites. {who} bleeds on the index and the index likes it.', damage: 10 },
      { weight: 1, text: 'A spell falls out, fully formed, and sits on {who}’s shoulder.', status: 'bless', duration: 25 },
    ],
  },
  mimic_chest: {
    id: 'mimic_chest',
    name: 'It Was Not A Chest',
    text: '{who} levers open the chest. The chest levers open {who}.',
    outcomes: [
      { weight: 4, text: 'Teeth. Just — teeth, all the way down.', damage: 22, spawn: 'bandit_cutthroat' },
      { weight: 2, text: '{who} gets a hand in and comes out holding something and bleeding proudly.', damage: 8, gold: 60 },
    ],
  },
  shrine_offer: {
    id: 'shrine_offer',
    name: 'The Quiet Saint Listens',
    text: '{who} kneels at the basin. The water goes very still.',
    outcomes: [
      { weight: 3, text: 'A warmth spreads through the party like good news.', healParty: 0.35 },
      { weight: 2, text: 'The saint asks for coin. The saint receives coin.', gold: -40, status: 'bless', duration: 40 },
      { weight: 1, text: 'She says nothing at all, which everyone agrees is worse.', threat: 3 },
    ],
  },
  ore_seam: {
    id: 'ore_seam',
    name: 'Good Ore',
    text: '{who} works a seam out of the wall with a pick somebody left behind.',
    outcomes: [
      { weight: 3, text: 'Honest silver. Heavy, dull, spendable.', gold: 45 },
      { weight: 1, text: 'The prop above gives. {who} gets clear with most of their hat.', damage: 12, gold: 20 },
    ],
  },
  campfire: {
    id: 'campfire',
    name: "Somebody Else's Camp",
    text: '{who} goes through the packs the last party never came back for.',
    outcomes: [
      { weight: 3, text: 'Rations, bandages, and a letter nobody reads aloud.', healParty: 0.25 },
      { weight: 2, text: 'A journal. The last page is a map, and the map is helpful.', reveal: 2 },
      { weight: 1, text: 'The bedrolls are still warm. Everyone stands up at once.', threat: 4 },
    ],
  },
  puzzle: {
    id: 'puzzle',
    name: 'Nine Dials, One Door',
    text: '{who} squares up to the riddle. It opens with "Assume you are lying."',
    outcomes: [
      { weight: 3, text: 'Click. Click. Clunk. The door remembers its manners.', gold: 120, xp: 40 },
      { weight: 2, text: 'Wrong dial. The room expresses disappointment in darts.', damage: 16 },
      { weight: 2, text: '{who} simply prises the hinges off. The riddle is furious.', gold: 60, threat: 2 },
    ],
  },
  deep_water: {
    id: 'deep_water',
    name: 'The Lake Has A Bottom',
    text: '{who} wades in to see how deep it goes. It goes.',
    outcomes: [
      { weight: 3, text: 'Something down there was drowned holding a purse. It is a good purse.', gold: 80 },
      { weight: 2, text: 'Cold to the bone. {who} comes up shaking and short of breath.', damage: 12, status: 'slow', duration: 12 },
      { weight: 1, text: 'The water lets go of something big, and then lets go of it entirely.', spawn: 'bog_lurker' },
    ],
  },
  fungus_patch: {
    id: 'fungus_patch',
    name: 'Do Not Eat The Blue Ones',
    text: '{who} harvests caps. There is a colour-coding system and nobody agrees on it.',
    outcomes: [
      { weight: 3, text: 'Medicinal. Genuinely, boringly medicinal.', healParty: 0.3 },
      { weight: 2, text: '{who} eats a blue one. Time gets interesting for a while.', status: 'haste', duration: 20, damage: 6 },
      { weight: 2, text: 'The patch objects to being harvested, at length, with limbs.', spawn: 'myconid_thrall' },
    ],
  },
  anvil: {
    id: 'anvil',
    name: 'The Anvil Is Still Warm',
    text: '{who} strikes the anvil once, to see. It answers.',
    outcomes: [
      { weight: 3, text: 'A blade comes out of the coals that nobody put in.', gear: 'fine' },
      { weight: 2, text: 'The coals flare. {who} loses eyebrows, gains respect.', damage: 10, status: 'burn', duration: 5 },
    ],
  },
  still: {
    id: 'still',
    name: 'The Notes Stop Mid-Word',
    text: '{who} reads the alchemist’s notes and then, unwisely, follows them.',
    outcomes: [
      { weight: 3, text: 'A steadying draught. Everyone gets a mouthful and nobody dies of it.', healParty: 0.25 },
      { weight: 2, text: 'The glassware disagrees violently with being moved.', damage: 14, status: 'burn', duration: 6 },
      { weight: 1, text: 'A vial of something that makes hands steadier than hands should be.', status: 'bless', duration: 35 },
    ],
  },
  tome: {
    id: 'tome',
    name: 'A Tome Worth Carrying',
    text: '{who} finds one book among ten thousand that is worth the weight.',
    outcomes: [
      { weight: 3, text: 'Guild appraisal: substantial. Guild opinion of {who}: improved.', gold: 90, xp: 30 },
      { weight: 2, text: 'It is written in a language {who} does not know, and now does.', xp: 60 },
    ],
  },
  rack: {
    id: 'rack',
    name: 'Racks, Mostly Full',
    text: '{who} works down the weapon racks with a professional eye.',
    outcomes: [
      { weight: 3, text: 'Serviceable steel, barely used. Its owners were not so lucky.', gear: 'common' },
      { weight: 2, text: 'Under the rack, a locked case. Not locked for long.', gear: 'fine' },
    ],
  },
  hoard: {
    id: 'hoard',
    name: 'Heaped Coin',
    text: '{who} stands in front of more money than the guild has ever held.',
    outcomes: [
      { weight: 3, text: 'They fill everything that can be filled. Pockets. Boots. A helmet.', gold: 200, threat: 5 },
      { weight: 2, text: 'The pile shifts. Counting yourself is the last thing you want a hoard to do.', gold: 140, spawnMimic: true },
    ],
  },
  dart_trap: {
    id: 'dart_trap',
    name: 'The Tiles Are A Puzzle',
    text: '{who} steps on the beautiful pattern.',
    outcomes: [
      { weight: 3, text: 'Darts. From everywhere. {who} makes it to the far wall mostly intact.', damage: 18, status: 'poison', duration: 8 },
      { weight: 2, text: 'A rogue’s eye catches the seam. The gallery is disarmed and robbed.', gold: 70, requireScout: true },
    ],
  },
};

export function getEvent(id) {
  return EVENTS[id] || null;
}
