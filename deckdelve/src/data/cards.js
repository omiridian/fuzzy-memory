// The room cards. These are the whole roguelike: what you can build, what it
// costs you in Threat, and what is waiting inside when somebody opens the door.
//
// Doors are a 4-bit mask. Rotating a card rotates the mask, which is why every
// card that is not radially symmetric is worth turning over in your hand.

export const DOOR_N = 1;
export const DOOR_E = 2;
export const DOOR_S = 4;
export const DOOR_W = 8;
export const ALL_DOORS = DOOR_N | DOOR_E | DOOR_S | DOOR_W;

/** Side index 0..3 is N, E, S, W — the order used everywhere in the grid. */
export const SIDES = [
  { bit: DOOR_N, dx: 0, dy: -1, name: 'north' },
  { bit: DOOR_E, dx: 1, dy: 0, name: 'east' },
  { bit: DOOR_S, dx: 0, dy: 1, name: 'south' },
  { bit: DOOR_W, dx: -1, dy: 0, name: 'west' },
];

/** Rotates a door mask clockwise `turns` quarter-turns. */
export function rotateDoors(mask, turns) {
  const t = ((turns % 4) + 4) % 4;
  let out = 0;
  for (let side = 0; side < 4; side++) {
    if (mask & SIDES[side].bit) out |= SIDES[(side + t) % 4].bit;
  }
  return out;
}

/** How many distinct rotations a door mask actually has (1, 2 or 4). */
export function rotationCount(mask) {
  for (let turns = 1; turns < 4; turns++) {
    if (rotateDoors(mask, turns) === mask) return turns;
  }
  return 4;
}

// Tags drive room-combination biomes. Keep them few and evocative.
export const TAGS = {
  UNDEAD: 'undead',
  NATURE: 'nature',
  ARCANE: 'arcane',
  GOBLIN: 'goblin',
  FIRE: 'fire',
  ANCIENT: 'ancient',
  HOLY: 'holy',
  TREASURE: 'treasure',
};

// `contents` is a recipe, not a result: the dungeon rolls it when the card is
// placed, scaled by depth and Threat. `feature` is a thing adventurers can
// interact with; `event` fires the first time someone walks in.
export const CARDS = [
  {
    id: 'stone_hall',
    name: 'Stone Hall',
    doors: DOOR_N | DOOR_S,
    tags: [],
    threat: 0,
    weight: 10,
    floor: 'stone',
    decor: 'plain',
    tier: 0,
    blurb: 'A corridor. Somebody swept it recently, which is its own kind of worrying.',
    discovery: 'A long hall, swept clean. Nobody mentions who did the sweeping.',
    contents: {},
  },
  {
    id: 'crossroads',
    name: 'Crossroads',
    doors: ALL_DOORS,
    tags: [],
    threat: 1,
    weight: 8,
    floor: 'stone',
    decor: 'plain',
    tier: 0,
    blurb: 'Four ways out. Statistically, three of them are mistakes.',
    discovery: 'Four doorways meet under a cracked keystone.',
    contents: { loot: { chance: 0.2, grade: 'petty' } },
  },
  {
    id: 'torchlit_corridor',
    name: 'Torchlit Corridor',
    doors: DOOR_N | DOOR_E,
    tags: [],
    threat: 0,
    weight: 8,
    floor: 'stone',
    decor: 'torches',
    tier: 0,
    light: 1.35,
    blurb: 'Freshly lit torches. Freshly lit by whom is left as an exercise.',
    discovery: 'The torches here are lit and dripping. Recently lit.',
    contents: {},
  },
  {
    id: 'collapsed_mine',
    name: 'Collapsed Mine',
    doors: DOOR_N | DOOR_E | DOOR_W,
    tags: [],
    threat: 1,
    weight: 6,
    floor: 'cave',
    decor: 'rubble',
    tier: 0,
    blurb: 'Old props, older dust, and ore nobody had time to carry out.',
    discovery: 'Pit props groan overhead. There is still ore in the walls.',
    contents: { loot: { chance: 0.75, grade: 'petty' }, feature: 'ore_seam' },
  },
  {
    id: 'guard_post',
    name: 'Goblin Guard Post',
    doors: DOOR_N | DOOR_S | DOOR_E,
    tags: [TAGS.GOBLIN],
    threat: 3,
    weight: 7,
    floor: 'stone',
    decor: 'camp',
    tier: 0,
    blurb: 'Two goblins, a stool, and a rota nobody has ever honoured.',
    discovery: 'A guard post. The duty rota on the wall has one name, scratched out twelve times.',
    contents: { enemies: [{ type: 'goblin_skirmisher', count: [2, 3] }], loot: { chance: 0.5, grade: 'petty' } },
  },
  {
    id: 'monster_den',
    name: 'Monster Den',
    doors: DOOR_S | DOOR_E,
    tags: [TAGS.GOBLIN, TAGS.NATURE],
    threat: 5,
    weight: 6,
    floor: 'cave',
    decor: 'bones',
    tier: 1,
    blurb: 'Straw, gnawed bones, and a smell with opinions.',
    discovery: 'Something has been nesting here. Recently. Warmly.',
    contents: {
      enemies: [
        { type: 'goblin_skirmisher', count: [2, 3] },
        { type: 'cave_spider', count: [1, 2] },
      ],
      loot: { chance: 0.7, grade: 'common' },
    },
  },
  {
    id: 'crypt',
    name: 'Crypt',
    doors: DOOR_N | DOOR_S,
    tags: [TAGS.UNDEAD, TAGS.ANCIENT],
    threat: 5,
    weight: 7,
    floor: 'marble',
    decor: 'tombs',
    tier: 1,
    blurb: 'Names worn off the slabs. Their owners have not forgotten them.',
    discovery: 'Slab tombs, lids ajar. The dust has been disturbed from the inside.',
    contents: {
      enemies: [{ type: 'skeleton_warrior', count: [2, 3] }],
      loot: { chance: 0.6, grade: 'common' },
    },
  },
  {
    id: 'ossuary',
    name: 'Ossuary',
    doors: DOOR_N | DOOR_E | DOOR_W,
    tags: [TAGS.UNDEAD],
    threat: 6,
    weight: 5,
    floor: 'stone',
    decor: 'bones',
    tier: 1,
    blurb: 'Ten thousand femurs, sorted by length. Somebody down here has a system.',
    discovery: 'Bones stacked to the ceiling, sorted by size. That is the unsettling part.',
    contents: {
      enemies: [
        { type: 'skeleton_warrior', count: [1, 2] },
        { type: 'ghoul', count: [1, 2] },
      ],
      loot: { chance: 0.5, grade: 'common' },
    },
  },
  {
    id: 'shrine',
    name: 'Shrine of the Quiet Saint',
    doors: DOOR_S | DOOR_W,
    tags: [TAGS.HOLY],
    threat: 1,
    weight: 5,
    floor: 'marble',
    decor: 'shrine',
    tier: 0,
    light: 1.3,
    blurb: 'She listens. She rarely answers. The water is clean, though.',
    discovery: 'A saint with her finger to her lips. The basin at her feet is full of clean water.',
    contents: { feature: 'shrine', loot: { chance: 0.2, grade: 'petty' } },
  },
  {
    id: 'treasure_vault',
    name: 'Treasure Vault',
    doors: DOOR_S,
    tags: [TAGS.TREASURE],
    threat: 8,
    weight: 4,
    floor: 'marble',
    decor: 'hoard',
    tier: 2,
    blurb: 'Everything you came for, behind one door, guarded by everything you did not.',
    discovery: 'Coin. Actual heaped coin. And the distinct sense of being counted.',
    contents: {
      enemies: [{ type: 'bandit_cutthroat', count: [1, 2] }],
      loot: { chance: 1, grade: 'fine', rolls: 2 },
      feature: 'hoard',
    },
  },
  {
    id: 'old_library',
    name: 'Old Library',
    doors: DOOR_N | DOOR_W,
    tags: [TAGS.ARCANE, TAGS.ANCIENT],
    threat: 3,
    weight: 5,
    floor: 'wood',
    decor: 'books',
    tier: 1,
    blurb: 'Shelves of the collected screaming of scholars. Some of it is still fresh.',
    discovery: 'Shelf after shelf, and one book left open at a page about doors.',
    contents: { feature: 'tome', event: 'library_whisper', loot: { chance: 0.4, grade: 'common' } },
  },
  {
    id: 'alchemy_lab',
    name: 'Alchemy Lab',
    doors: DOOR_E | DOOR_W,
    tags: [TAGS.ARCANE, TAGS.FIRE],
    threat: 4,
    weight: 5,
    floor: 'wood',
    decor: 'lab',
    tier: 1,
    blurb: 'Glassware, notes, and a stain on the ceiling shaped like a person.',
    discovery: 'Bubbling glassware. The notes stop mid-sentence, mid-word, really.',
    contents: {
      enemies: [{ type: 'fire_imp', count: [1, 2], chance: 0.7 }],
      feature: 'still',
      loot: { chance: 0.6, grade: 'common' },
    },
  },
  {
    id: 'armoury',
    name: 'Armoury',
    doors: DOOR_N | DOOR_S | DOOR_W,
    tags: [TAGS.TREASURE],
    threat: 3,
    weight: 5,
    floor: 'stone',
    decor: 'racks',
    tier: 1,
    blurb: 'Racks of gear the last expedition did not live long enough to draw.',
    discovery: 'Weapon racks, mostly full. Mostly is doing a lot of work in that sentence.',
    contents: { feature: 'rack', loot: { chance: 0.9, grade: 'common', gear: true } },
  },
  {
    id: 'trapped_gallery',
    name: 'Trapped Gallery',
    doors: DOOR_N | DOOR_S,
    tags: [TAGS.ANCIENT],
    threat: 4,
    weight: 5,
    floor: 'marble',
    decor: 'traps',
    tier: 1,
    blurb: 'The tiles are a puzzle. The puzzle is lethal. The prize is real.',
    discovery: 'Pressure plates in a pattern. The pattern is beautiful. That is the bait.',
    contents: { hazard: 'dart_trap', loot: { chance: 0.8, grade: 'fine' } },
  },
  {
    id: 'underground_lake',
    name: 'Underground Lake',
    doors: DOOR_N | DOOR_E | DOOR_S | DOOR_W,
    tags: [TAGS.NATURE, TAGS.ARCANE],
    threat: 3,
    weight: 5,
    floor: 'water',
    decor: 'water',
    tier: 1,
    blurb: 'Still, cold, and deeper than the room has any right to allow.',
    discovery: 'Black water, perfectly still, reflecting a ceiling that is not there.',
    contents: {
      enemies: [{ type: 'bog_lurker', count: [1, 1], chance: 0.6 }],
      feature: 'deep_water',
      loot: { chance: 0.4, grade: 'fine' },
    },
  },
  {
    id: 'mushroom_cave',
    name: 'Mushroom Cave',
    doors: DOOR_N | DOOR_E | DOOR_S,
    tags: [TAGS.NATURE],
    threat: 3,
    weight: 6,
    floor: 'cave',
    decor: 'fungus',
    tier: 0,
    blurb: 'Softly glowing. Softly breathing. Definitely do not eat the blue ones.',
    discovery: 'Caps the size of tables, glowing gently, leaning towards the light you brought.',
    contents: {
      enemies: [{ type: 'myconid_thrall', count: [2, 3] }],
      feature: 'fungus_patch',
      loot: { chance: 0.35, grade: 'petty' },
    },
  },
  {
    id: 'camp',
    name: "Delvers' Camp",
    doors: DOOR_N | DOOR_S | DOOR_E,
    tags: [],
    threat: 0,
    weight: 5,
    floor: 'stone',
    decor: 'camp',
    tier: 0,
    light: 1.25,
    blurb: 'Somebody else got this far, made tea, and did not get further.',
    discovery: 'A cold campfire, four bedrolls, and three packs still neatly stowed.',
    contents: { feature: 'campfire', loot: { chance: 0.5, grade: 'petty' } },
  },
  {
    id: 'lava_chamber',
    name: 'Lava Chamber',
    doors: DOOR_E | DOOR_W,
    tags: [TAGS.FIRE],
    threat: 6,
    weight: 4,
    floor: 'ash',
    decor: 'lava',
    tier: 2,
    light: 1.4,
    blurb: 'The floor is hot. The air is hotter. Something in there is comfortable.',
    discovery: 'Heat rolls out of the doorway like a held breath. Orange light on every face.',
    contents: {
      enemies: [{ type: 'fire_imp', count: [2, 3] }],
      hazard: 'heat',
      loot: { chance: 0.5, grade: 'fine' },
    },
  },
  {
    id: 'forge',
    name: 'Deep Forge',
    doors: DOOR_N | DOOR_W,
    tags: [TAGS.FIRE, TAGS.TREASURE],
    threat: 5,
    weight: 4,
    floor: 'stone',
    decor: 'forge',
    tier: 2,
    light: 1.3,
    blurb: 'Cold anvil, banked coals. It wants to be lit. It says so, quietly.',
    discovery: 'An anvil the size of a cart, and coals that have been banked for four centuries.',
    contents: { feature: 'anvil', loot: { chance: 0.7, grade: 'fine', gear: true } },
  },
  {
    id: 'puzzle_room',
    name: 'Puzzle Room',
    doors: DOOR_N | DOOR_E | DOOR_S | DOOR_W,
    tags: [TAGS.ARCANE, TAGS.ANCIENT],
    threat: 3,
    weight: 4,
    floor: 'marble',
    decor: 'puzzle',
    tier: 1,
    blurb: 'A door with nine locks and a riddle about honesty. Bring somebody clever.',
    discovery: 'Nine dials, one door, and a riddle that opens with "Assume you are lying".',
    contents: { feature: 'puzzle', loot: { chance: 1, grade: 'fine' } },
  },
  {
    id: 'wardens_gate',
    name: "Warden's Gate",
    doors: DOOR_N | DOOR_S,
    tags: [TAGS.ANCIENT, TAGS.TREASURE],
    threat: 10,
    weight: 2,
    floor: 'marble',
    decor: 'gate',
    tier: 3,
    unique: true,
    minDepth: 3,
    blurb: 'A chest at the end of a hall of chests. Only one of them is breathing.',
    discovery: 'A hall of chests, all identical, all shut. One of them is very slightly warm.',
    contents: {
      boss: 'grumwick',
      loot: { chance: 1, grade: 'superb' },
    },
  },
  {
    id: 'boss_chamber',
    name: 'Vault of Cindervex',
    doors: DOOR_N | DOOR_E | DOOR_S | DOOR_W,
    tags: [TAGS.ANCIENT, TAGS.TREASURE, TAGS.FIRE],
    threat: 14,
    weight: 1,
    floor: 'ash',
    decor: 'hoard',
    tier: 4,
    unique: true,
    minDepth: 5,
    light: 1.2,
    blurb: 'The last room. The big one. Do not place it until you mean it.',
    discovery: 'The ceiling is gold. No — the ceiling is coin, and the coin is moving.',
    contents: {
      boss: 'cindervex',
      loot: { chance: 1, grade: 'superb', rolls: 3 },
    },
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function getCard(id) {
  const card = CARD_BY_ID[id];
  if (!card) throw new Error(`unknown card: ${id}`);
  return card;
}

/** The entrance is not a card you hold — it is where every expedition begins. */
export const ENTRANCE = {
  id: 'entrance',
  name: 'Dungeon Entrance',
  doors: ALL_DOORS,
  tags: [],
  threat: 0,
  floor: 'stone',
  decor: 'entrance',
  tier: 0,
  light: 1.5,
  blurb: 'Daylight, a rope ladder, and the last safe air for a long while.',
  discovery: 'Daylight behind you. It looks further away than it is.',
  contents: { feature: 'exit' },
};

/**
 * Cards the guild hands out for free on day one. Two crypts and a shrine are in
 * here on purpose: the Corrupted Necropolis should be something a first-time
 * player can stumble into, not something they have to save up for.
 */
export const STARTER_CARDS = [
  'stone_hall',
  'stone_hall',
  'crossroads',
  'torchlit_corridor',
  'guard_post',
  'monster_den',
  'crypt',
  'crypt',
  'shrine',
  'camp',
  'mushroom_cave',
  'collapsed_mine',
  'armoury',
  'old_library',
];
