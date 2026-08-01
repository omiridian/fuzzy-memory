// The world. Maps are ASCII grids; see world/tiles.js for the character
// legend. Digits 0-9 are warp markers: the loader replaces each with the tile
// named in `look` and links it to the matching marker on the destination map,
// so no map ever has to hard-code another map's coordinates.
//
// Encounter tables name habitat tags (see data/speciesgen.js) rather than
// species ids, so the procedural roster slots into the world automatically.
// `featured` entries pin specific hand-authored species to a route.

export const MAPS = {};

function map(id, def) {
  MAPS[id] = { id, ...def };
  return MAPS[id];
}

// ═══════════════════════════════════════════════════════════════════════════
// Hearthvale — the starting town
// ═══════════════════════════════════════════════════════════════════════════
map('hearthvale', {
  name: 'Hearthvale',
  music: 'town',
  outdoor: true,
  tiles: [
    '##############################',
    '#############....#############',
    '###.........p....p.........###',
    '###..OOOO...p....p...OOOO..###',
    '###..O==O...p....p...O==O..###',
    '###..O==O...p....p...O==O..###',
    '###..OO1O...p....p...OO2O..###',
    '###.........p....p.........###',
    '###.pppppppppppppppppppppp.###',
    '###.p....f...pp...f......p.###',
    '###.p..OOOOO.pp.OOOOOOO..p.###',
    '###.p..O===O.pp.O=====O..p.###',
    '###.p..O===O.pp.O=====O..p.###',
    '###.p..OO3OO.pp.OOO4OOO..p.###',
    '###.p........pp..........p.###',
    '###.pppppppppppppppppppppp.###',
    '###..f...S...pp...f....f...###',
    '####.........pp............###',
    '#####........55...........####',
    '##############################',
  ],
  warps: {
    1: { to: 'player_home', at: 1, look: 'D' },
    2: { to: 'lab', at: 1, look: 'D' },
    3: { to: 'waystation_hearthvale', at: 1, look: 'D' },
    4: { to: 'hearthvale_shop', at: 1, look: 'D' },
    5: { to: 'route1', at: 2, look: 'p' },
  },
  spawn: { x: 14, y: 9 },
  signs: [
    { x: 9, y: 16, text: 'HEARTHVALE\nWhere the road starts and the kettle is always on.' },
  ],
  npcs: [
    {
      id: 'hv_kid',
      x: 8, y: 9, sprite: 'child', dir: 'down',
      dialogue: [
        "Professor Aldrin's lab is the big one on the hill!",
        'She says the Weave is what lets creatures do the impossible. I think it just means magic.',
      ],
    },
    {
      id: 'hv_gran',
      x: 21, y: 14, sprite: 'elder', dir: 'left',
      dialogue: [
        'In my day we walked to Tidefall. Uphill. Both ways.',
        'Mind the tall grass on Meadow Road. Things live in it that would rather you did not.',
      ],
    },
    {
      id: 'hv_mother',
      x: 12, y: 17, sprite: 'woman', dir: 'down',
      dialogue: [
        "Off already? Don't let the Professor talk you into anything you can't carry.",
        'I packed you salves. Check your bag.',
      ],
      onTalkOnce: { give: { item: 'potion', qty: 3 }, flag: 'hv_mother_gift' },
    },
  ],
  encounters: {
    grass: { habitats: ['grass_early', 'town'], levels: [2, 4], featured: [{ species: 'nibbet', weight: 30 }] },
  },
});

map('player_home', {
  name: 'Your House',
  indoor: true,
  tiles: [
    '|||||||||||||',
    '|=h==b==t===|',
    '|===========|',
    '|==o=====o==|',
    '|===========|',
    '|===========|',
    '|=====1=====|',
    '|||||||||||||',
  ],
  warps: { 1: { to: 'hearthvale', at: 1, look: 'D' } },
  spawn: { x: 6, y: 5 },
  npcs: [
    {
      id: 'home_pc',
      x: 4, y: 1, sprite: 'terminal', dir: 'down', solid: true,
      storage: true,
      dialogue: ['The storage terminal hums. Creatures you cannot carry rest here.'],
    },
  ],
});

map('lab', {
  name: "Aldrin's Laboratory",
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|b_b_b_______b|',
    '|____________b|',
    '|__t_t_t_____ |',
    '|____________ |',
    '|__CC___CC____|',
    '|____________ |',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'hearthvale', at: 2, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    {
      id: 'aldrin',
      x: 7, y: 4, sprite: 'professor', dir: 'down', solid: true,
      script: 'aldrin_intro',
    },
    {
      id: 'lab_aide',
      x: 3, y: 3, sprite: 'aide', dir: 'right',
      dialogue: [
        'The Professor has been awake for two days. Do not mention it.',
        'A creature that likes you fights harder. That is not sentiment, it is measurable.',
      ],
    },
    {
      id: 'starter_case',
      x: 10, y: 5, sprite: 'case', dir: 'down', solid: true,
      script: 'starter_case',
    },
  ],
});

map('waystation_hearthvale', {
  name: 'Hearthvale Waystation',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__H________b_|',
    '|_____C_____b_|',
    '|_____C_______|',
    '|_____________|',
    '|__t_t____t_t_|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'hearthvale', at: 3, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    { id: 'hv_nurse', x: 3, y: 1, sprite: 'nurse', dir: 'down', solid: true, healer: true },
    {
      id: 'hv_clerk', x: 5, y: 3, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['orb', 'potion', 'antidote', 'burnsalve', 'paralyzeheal', 'awakening', 'repel'],
    },
    {
      id: 'hv_trav', x: 10, y: 5, sprite: 'man', dir: 'left',
      dialogue: [
        'Waystations heal your whole team, free. The Wardens insisted on it.',
        'The Cinder Compact says the Weave is a resource. The Wardens say it is a spine. Guess which one has more money.',
      ],
    },
  ],
});

map('hearthvale_shop', {
  name: 'Hearthvale Provisions',
  indoor: true,
  tiles: [
    '|||||||||||||',
    '|b_______b__|',
    '|___CCC_____|',
    '|___________|',
    '|__t_____t__|',
    '|___________|',
    '|_____1_____|',
    '|||||||||||||',
  ],
  warps: { 1: { to: 'hearthvale', at: 4, look: 'D' } },
  spawn: { x: 6, y: 5 },
  npcs: [
    {
      id: 'hv_shopkeep', x: 5, y: 2, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['orb', 'greatorb', 'potion', 'superpotion', 'revive', 'escaperope', 'herb', 'berrysweet'],
    },
    {
      id: 'hv_buyer', x: 9, y: 4, sprite: 'woman', dir: 'left',
      dialogue: ['Sell them your old junk. Nuggets and pearls fetch a proper price.'],
    },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Route 1 — Meadow Road
// ═══════════════════════════════════════════════════════════════════════════
map('route1', {
  name: 'Meadow Road',
  music: 'route',
  outdoor: true,
  tiles: [
    '##############################',
    '#####........33............###',
    '####..,,,,...####...,,,,,,,.##',
    '###..,,,,,,..####..,,,,,,,,.##',
    '###..,,,,,,........,,,,,,,,.##',
    '###...,,,,....pp.....,,,,,..##',
    '####..........pp...........###',
    '####..S.......pp.......f...###',
    '#####.........pp...........###',
    '####..,,,,....pp....OOOO...###',
    '###..,,,,,,...pp....O==O...###',
    '###..,,,,,,...pp....O==O...###',
    '###..,,,,,,...pp....OO1O...###',
    '####..,,,,....pp...........###',
    '####..........pp......,,,,.###',
    '#####...ffff..pp.....,,,,,,.##',
    '#####.........pp......,,,,,.##',
    '######........pp...........###',
    '######........22...........###',
    '##############################',
  ],
  warps: {
    1: { to: 'meadow_cabin', at: 1, look: 'D' },
    2: { to: 'hearthvale', at: 5, look: 'p' },
    3: { to: 'emberwood', at: 3, look: 'p' },
  },
  spawn: { x: 14, y: 17 },
  signs: [
    { x: 6, y: 7, text: 'MEADOW ROAD\nNorth to Emberwood. Watch the grass.' },
  ],
  npcs: [
    {
      id: 'r1_scout',
      x: 12, y: 12, sprite: 'youth', dir: 'right',
      trainer: {
        name: 'Scout Perrin', title: 'Scout', prize: 320, ai: 2,
        team: [{ habitat: 'grass_early', level: 6 }, { habitat: 'forest', level: 7 }],
        dialogue: {
          intro: "You're the one Aldrin sent out? Let's see it.",
          defeat: 'Fair enough. The road ahead is worse than me.',
          after: 'Emberwood is north. The Grove Warden holds trials there.',
        },
      },
      dialogue: ['Every trainer on this road will fight you. That is what the road is for.'],
    },
    {
      id: 'r1_forager',
      x: 22, y: 5, sprite: 'woman', dir: 'down',
      trainer: {
        name: 'Forager Idi', title: 'Forager', prize: 280, ai: 2,
        team: [{ habitat: 'forest', level: 7 }],
        dialogue: {
          intro: 'I only came out for herbs. But fine.',
          defeat: 'Take some herbs. Go on.',
          after: 'Herbs sell for a little. Nuggets sell for a lot.',
        },
        reward: { item: 'herb', qty: 3 },
      },
    },
    {
      id: 'r1_hiker',
      x: 20, y: 16, sprite: 'man', dir: 'up',
      dialogue: [
        'A creature that is asleep or paralysed is far easier to catch.',
        'Wear it down first. Then throw.',
      ],
    },
  ],
  items: [
    { x: 8, y: 15, item: 'orb', qty: 5, flag: 'r1_orbs' },
    { x: 25, y: 3, item: 'potion', qty: 2, flag: 'r1_potion' },
  ],
  encounters: {
    grass: {
      habitats: ['grass_early', 'forest'],
      levels: [3, 7],
      featured: [
        { species: 'nibbet', weight: 22 },
        { species: 'flittle', weight: 20 },
        { species: 'mothlet', weight: 16 },
        { species: 'pebbling', weight: 10 },
      ],
    },
  },
});

map('meadow_cabin', {
  name: 'Roadside Cabin',
  indoor: true,
  tiles: [
    '|||||||||||||',
    '|=h=====b===|',
    '|===========|',
    '|==t=====t==|',
    '|===========|',
    '|=====1=====|',
    '|||||||||||||',
  ],
  warps: { 1: { to: 'route1', at: 1, look: 'D' } },
  spawn: { x: 6, y: 4 },
  npcs: [
    {
      id: 'cabin_trainer',
      x: 3, y: 3, sprite: 'elder', dir: 'right',
      script: 'nickname_service',
      dialogue: ['I name things. It is a small skill but it is mine.'],
    },
    {
      id: 'cabin_healer',
      x: 9, y: 1, sprite: 'nurse', dir: 'down', solid: true, healer: true,
      dialogue: ['Rest here. The road does not care how tired you are.'],
    },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Emberwood — forest and the Grove Hall (Warden 1: Verdant)
// ═══════════════════════════════════════════════════════════════════════════
map('emberwood', {
  name: 'Emberwood',
  music: 'forest',
  outdoor: true,
  tiles: [
    '##############################',
    '###########.44.###############',
    '#####,,,,,,.pp.,,,,,,,,,,,#####',
    '####,,,,,,,.pp.,,,,,,,,,,,,####',
    '####,,,##,,.pp.,,,##,,,,,,,####',
    '####,,,##,,.pp.,,,##,,,,,,,####',
    '####,,,,,,.,pp.,,,,,,,,,,,,####',
    '#####,,,,..,pp.,,,,,,,,,,,#####',
    '####.5=....,pp.............####',
    '####.O5OO..,pp....OOOO.....####',
    '####.O==O..,pp....O==O.....####',
    '####.O==O..,pp....O==O.....####',
    '####.OO1O..,pp....OO2O.....####',
    '####.......,pp.............####',
    '#####,,,,,,,pp,,,,,,,S,,,,#####',
    '#####,,,,,,,pp,,,,,,,,,,,,#####',
    '######,,,,,,pp,,,,,,,,,,,######',
    '#######.....pp.....,,,,,,######',
    '#########...33...#############',
    '##############################',
  ],
  warps: {
    1: { to: 'grove_hall', at: 1, look: 'D' },
    2: { to: 'emberwood_hut', at: 1, look: 'D' },
    3: { to: 'route1', at: 3, look: 'p' },
    4: { to: 'coast_road', at: 3, look: 'p' },
    5: { to: 'heartwood', at: 1, look: '.', requires: 'heartwood_key', lockedText: 'A knot of living wood seals the way. Something would have to open it.' },
  },
  spawn: { x: 13, y: 17 },
  signs: [{ x: 21, y: 14, text: 'EMBERWOOD\nThe Grove Hall stands west. Warden Ilse presides.' }],
  npcs: [
    {
      id: 'ew_bugcatcher',
      x: 8, y: 6, sprite: 'youth', dir: 'right',
      trainer: {
        name: 'Netter Ovid', title: 'Netter', prize: 400, ai: 2,
        team: [{ habitat: 'forest', level: 9 }, { species: 'mothlet', level: 10 }],
        dialogue: {
          intro: 'You will not get past the trees without meeting the things in them.',
          defeat: 'They liked you better anyway.',
          after: 'Insect types fold to fire. Everyone knows. Nobody remembers in the moment.',
        },
      },
    },
    {
      id: 'ew_ranger',
      x: 20, y: 8, sprite: 'woman', dir: 'left',
      trainer: {
        name: 'Ranger Sabbe', title: 'Ranger', prize: 520, ai: 3,
        team: [{ habitat: 'forest', level: 11 }, { habitat: 'grass_early', level: 11 }],
        dialogue: {
          intro: 'The Compact has been through here. Cutting. You can smell it.',
          defeat: 'Go on to the Hall. Ilse will want to hear about them.',
          after: 'They took a whole grove. For "essence yield". Whatever that means.',
        },
      },
      questFlag: 'talked_sabbe',
    },
    {
      id: 'ew_hermit',
      x: 6, y: 16, sprite: 'elder', dir: 'down',
      dialogue: [
        'Some creatures only change shape after dark. Some only in daylight.',
        'If yours will not evolve, try coming back at a different hour.',
      ],
    },
  ],
  items: [
    { x: 25, y: 4, item: 'moss_stone', qty: 1, flag: 'ew_moss' },
    { x: 5, y: 3, item: 'superpotion', qty: 1, flag: 'ew_potion' },
  ],
  encounters: {
    grass: {
      habitats: ['forest', 'grass_early'],
      levels: [7, 12],
      featured: [
        { species: 'mothlet', weight: 20 },
        { species: 'sprigling', weight: 4 },
        { species: 'sporeling', weight: 14 },
        { species: 'flittle', weight: 12 },
      ],
    },
  },
});

map('emberwood_hut', {
  name: 'Woodcutter’s Hut',
  indoor: true,
  tiles: [
    '|||||||||||||',
    '|=b===t====h|',
    '|===========|',
    '|==o=====o==|',
    '|===========|',
    '|=====1=====|',
    '|||||||||||||',
  ],
  warps: { 1: { to: 'emberwood', at: 2, look: 'D' } },
  spawn: { x: 6, y: 4 },
  npcs: [
    {
      id: 'woodcutter',
      x: 4, y: 3, sprite: 'man', dir: 'down',
      script: 'tome_trader',
      dialogue: ['I trade tomes for herbs. Ten herbs, one tome. My prices are not negotiable.'],
    },
  ],
});

map('grove_hall', {
  name: 'Grove Hall',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__*********__|',
    '|__*_______*__|',
    '|__*__ooo__*__|',
    '|__*_______*__|',
    '|__*********__|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'emberwood', at: 1, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    {
      id: 'grove_aide',
      x: 4, y: 6, sprite: 'aide', dir: 'right',
      trainer: {
        name: 'Acolyte Wren', title: 'Acolyte', prize: 600, ai: 3,
        team: [{ habitat: 'forest', level: 12 }, { habitat: 'forest', level: 13 }],
        dialogue: {
          intro: 'The Warden sees challengers who can get past me.',
          defeat: 'Then she will see you.',
          after: 'Verdant bends but does not break. Bring fire, or bring patience.',
        },
      },
    },
    {
      id: 'warden_ilse',
      x: 7, y: 2, sprite: 'warden_verdant', dir: 'down', solid: true,
      script: 'warden_verdant',
    },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Coast Road and Tidefall (Warden 2: Tide)
// ═══════════════════════════════════════════════════════════════════════════
map('coast_road', {
  name: 'Coast Road',
  music: 'route',
  outdoor: true,
  tiles: [
    '##############################',
    '######.....33.....############',
    '#####.....pppp....############',
    '####..,,,.pppp.,,,,,..########',
    '####..,,,.pppp.,,,,,..########',
    '####......pppp........########',
    '###..sssssppppsssssss.########',
    '###.ss~~~~ppppp~~~~~ss.#######',
    '###.s~~~~~~pppp~~~~~~s.#######',
    '###.s~~WW~~pppp~~WW~~s.#######',
    '###.s~~WW~~pppp~~WW~~s.#######',
    '###.s~~~~~~pppp~~~~~~s.#######',
    '###.ss~~~~~pppp~~~~~ss.#######',
    '###..sssssspppps sssss.#######',
    '####......ppppp.......########',
    '####..,,..pppp..,,,,..########',
    '####..,,..pppp..,,,,..########',
    '#####.....pppp....S...########',
    '#####.....4444........########',
    '##############################',
  ],
  warps: {
    3: { to: 'emberwood', at: 4, look: 'p' },
    4: { to: 'tidefall', at: 4, look: 'P' },
  },
  spawn: { x: 11, y: 17 },
  signs: [{ x: 18, y: 17, text: 'COAST ROAD\nTidefall south. Emberwood north. Do not swim without a Warden’s leave.' }],
  npcs: [
    {
      id: 'cr_fisher',
      x: 6, y: 6, sprite: 'man', dir: 'right',
      trainer: {
        name: 'Angler Rho', title: 'Angler', prize: 640, ai: 3,
        team: [{ habitat: 'coast', level: 14 }, { habitat: 'coast', level: 15 }],
        dialogue: {
          intro: 'Nothing biting today. You will do.',
          defeat: 'Take the rod. I have three.',
          after: 'Cast from any shore. What comes up is not always a fish.',
        },
        reward: { item: 'rod', qty: 1 },
      },
      questFlag: 'beat_rho',
    },
    {
      id: 'cr_compact_1',
      x: 19, y: 15, sprite: 'compact', dir: 'left',
      trainer: {
        name: 'Compact Hand Vell', title: 'Cinder Compact', prize: 700, ai: 3,
        team: [{ species: 'cinderrat', level: 15 }, { habitat: 'sewer', level: 15 }],
        dialogue: {
          intro: 'This stretch is Compact ground now. Turn around.',
          defeat: 'You have no idea what you are standing in the way of.',
          after: 'The siphons run under Tidefall harbour. Go and look, if you like being frightened.',
        },
      },
      questFlag: 'compact_coast',
    },
  ],
  items: [{ x: 4, y: 13, item: 'pearl', qty: 1, flag: 'cr_pearl' }],
  encounters: {
    grass: { habitats: ['coast', 'grass_mid'], levels: [12, 16], featured: [{ species: 'shellcrab', weight: 0 }] },
    water: { habitats: ['coast', 'river'], levels: [10, 18], featured: [{ species: 'puddlet', weight: 6 }, { species: 'shellnip', weight: 18 }] },
    water_deep: { habitats: ['deep', 'coast'], levels: [16, 24], featured: [{ species: 'glimmerfin', weight: 5 }] },
  },
});

map('tidefall', {
  name: 'Tidefall',
  music: 'city',
  outdoor: true,
  tiles: [
    '##############################',
    '#####........44.........######',
    '####.PPPPPPPPPPPPPPPPPP.#####',
    '####.P..OOOO...OOOO....P.#####',
    '####.P..O==O...O==O....P.#####',
    '####.P..O==O...O==O....P.#####',
    '####.P..OO1O...OO2O....P.#####',
    '####.P.................P.#####',
    '####.PPPPPPPPPPPPPPPPPPP.#####',
    '####.P....OOOO.....P.....#####',
    '####.P....O==O.....P.....#####',
    '####.P....O==O.....P...66#####',
    '####.P....OO3O.....P.....#####',
    '####.P.............P.....#####',
    '####.PPPPPPPPPPPPPPP.....#####',
    '####.P..S..........BB....#####',
    '####.P.............BB....#####',
    '###~~~~~~~~~~~~~~~~BB~~~~~####',
    '###~~~~~~~~~~~~~~~~55~~~~~####',
    '##############################',
  ],
  warps: {
    1: { to: 'waystation_tidefall', at: 1, look: 'D' },
    2: { to: 'tidefall_shop', at: 1, look: 'D' },
    3: { to: 'tide_hall', at: 1, look: 'D' },
    4: { to: 'coast_road', at: 4, look: 'P' },
    5: { to: 'harbor', at: 1, look: 'B' },
    6: { to: 'copper_quarry', at: 2, look: 'P' },
  },
  spawn: { x: 14, y: 2 },
  signs: [{ x: 8, y: 15, text: 'TIDEFALL\nThe city the sea agreed to. Warden Maris keeps the Tide Hall.' }],
  npcs: [
    {
      id: 'tf_sailor',
      x: 21, y: 9, sprite: 'man', dir: 'left',
      dialogue: [
        'Harbour is south over the bridge. Ferry runs when the Warden says it runs.',
        'Compact freighters have been docking at night. Nobody signs for them.',
      ],
    },
    {
      id: 'tf_scholar',
      x: 8, y: 13, sprite: 'aide', dir: 'down',
      dialogue: [
        'Held items matter more than people think. Trail Rations alone have won me three matches.',
        'The shop here stocks proper gear now.',
      ],
    },
    {
      id: 'tf_child',
      x: 17, y: 7, sprite: 'child', dir: 'up',
      dialogue: ['I saw a creature made of light in the bay! Nobody believes me.'],
    },
  ],
  encounters: {
    water: { habitats: ['harbor', 'coast'], levels: [14, 20], featured: [{ species: 'shellnip', weight: 14 }] },
  },
});

map('waystation_tidefall', {
  name: 'Tidefall Waystation',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__H_______b__|',
    '|_____C____b__|',
    '|_____C_______|',
    '|_____________|',
    '|__t_t____t_t_|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'tidefall', at: 1, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    { id: 'tf_nurse', x: 3, y: 1, sprite: 'nurse', dir: 'down', solid: true, healer: true },
    {
      id: 'tf_clerk', x: 5, y: 3, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['orb', 'greatorb', 'potion', 'superpotion', 'revive', 'fullheal', 'repel', 'netorb'],
    },
    {
      id: 'tf_rest', x: 10, y: 5, sprite: 'woman', dir: 'left',
      dialogue: ['Creatures you catch beyond six go to your storage terminal. There is one in every waystation.'],
      storage: true,
    },
  ],
});

map('tidefall_shop', {
  name: 'Tidefall Market',
  indoor: true,
  tiles: [
    '|||||||||||||',
    '|b__CCC___b_|',
    '|___________|',
    '|__t_____t__|',
    '|___________|',
    '|_____1_____|',
    '|||||||||||||',
  ],
  warps: { 1: { to: 'tidefall', at: 2, look: 'D' } },
  spawn: { x: 6, y: 4 },
  npcs: [
    {
      id: 'tf_shopkeep', x: 5, y: 1, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['leftovers', 'berrysweet', 'cleanseberry', 'quickclaw', 'focussash', 'tide_gem', 'tome_watercannon', 'tome_protect', 'tome_rest'],
    },
    {
      id: 'tf_broker', x: 9, y: 3, sprite: 'man', dir: 'left',
      script: 'treasure_broker',
      dialogue: ['I buy treasure. Nuggets, pearls, skyshards. Bring me anything that shines.'],
    },
  ],
});

map('tide_hall', {
  name: 'Tide Hall',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__wwwwwwwww__|',
    '|__w_______w__|',
    '|__w__***__w__|',
    '|__w_______w__|',
    '|__wwww_wwww__|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'tidefall', at: 3, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    {
      id: 'tide_aide',
      x: 3, y: 6, sprite: 'aide', dir: 'right',
      trainer: {
        name: 'Deckhand Oro', title: 'Deckhand', prize: 900, ai: 3,
        team: [{ habitat: 'coast', level: 18 }, { habitat: 'harbor', level: 19 }],
        dialogue: {
          intro: 'Warden Maris is at the far end. Get past me first.',
          defeat: 'Go on then.',
          after: 'Volt cuts through Tide. So does Verdant. Bring one.',
        },
      },
    },
    {
      id: 'warden_maris',
      x: 7, y: 2, sprite: 'warden_tide', dir: 'down', solid: true,
      script: 'warden_tide',
    },
  ],
});

map('harbor', {
  name: 'Tidefall Harbour',
  outdoor: true,
  tiles: [
    '##############################',
    '###~~~~~~~~~~11~~~~~~~~~~~####',
    '###~~~~~~~~~~BB~~~~~~~~~~~####',
    '###~~~sssssssBBsssssss~~~~####',
    '###~~~sPPPPPPPPPPPPPPs~~~~####',
    '###~~~sP...........GPs~~~~####',
    '###~~~sP..OOOOOOO...Ps~~~~####',
    '###~~~sP..O=====O...Ps~~~~####',
    '###~~~sP..O=====O...Ps~~~~####',
    '###~~~sP..OOO2OOO...Ps~~~~####',
    '###~~~sP............Ps~~~~####',
    '###~~~sPPPPPPPPPPPPPPs~~~~####',
    '###~~~ssssssssssssssss~~~~####',
    '###~~~~~~~~~~~~~~~~~~~~~~~####',
    '###~~~~~~~~~WWWW~~~~~~~~~~####',
    '###~~~~~~~~~WWWW~~~~~~~~~~####',
    '###~~~~~~~~~~~~~~~~~~~~~~~####',
    '##############################',
  ],
  warps: {
    1: { to: 'tidefall', at: 5, look: 'B' },
    2: { to: 'siphon_house', at: 2, look: 'D' },
  },
  spawn: { x: 13, y: 3 },
  npcs: [
    {
      id: 'hb_guard',
      x: 19, y: 5, sprite: 'compact', dir: 'left',
      script: 'harbor_guard',
    },
    {
      id: 'hb_dock',
      x: 8, y: 10, sprite: 'man', dir: 'up',
      dialogue: ['That warehouse was empty for years. Now it hums at night.'],
    },
  ],
  encounters: {
    water: { habitats: ['harbor', 'coast'], levels: [16, 22] },
    water_deep: { habitats: ['deep'], levels: [22, 28] },
  },
});

map('siphon_house', {
  name: 'Compact Warehouse',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|___iiiiiii___|',
    '|___i_____i___|',
    '|___i_ooo_i___|',
    '|___i_____i___|',
    '|___iiiiiii___|',
    '|_____________|',
    '|______2______|',
    '|||||||||||||||',
  ],
  warps: { 2: { to: 'harbor', at: 2, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    {
      id: 'siphon_boss',
      x: 7, y: 2, sprite: 'compact_officer', dir: 'down', solid: true,
      script: 'siphon_confrontation',
    },
    {
      id: 'siphon_grunt',
      x: 4, y: 6, sprite: 'compact', dir: 'right',
      trainer: {
        name: 'Compact Hand Ruse', title: 'Cinder Compact', prize: 900, ai: 3,
        team: [{ species: 'cinderrat', level: 19 }, { habitat: 'facility', level: 20 }],
        dialogue: {
          intro: 'Nobody comes in here.',
          defeat: 'You are making a mistake in writing.',
          after: 'The siphon pulls essence straight out of the Weave. It works. That is the problem.',
        },
      },
    },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Copper Quarry — cave route to Stormridge
// ═══════════════════════════════════════════════════════════════════════════
map('copper_quarry', {
  name: 'Copper Quarry',
  music: 'cave',
  cave: true,
  tiles: [
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%11%%%%%%%%%%%%%%%%',
    '%%%%xxxx%%%%XX%%%%xxxxxx%%%%%%',
    '%%%xxxxxx%%%XX%%%xxxxxxxx%%%%%',
    '%%%xxxxxx%%%XX%%%xxxxxxxx%%%%%',
    '%%%xxxxxXXXXXXXXXxxxxxxxx%%%%%',
    '%%%xxxxxX%%%XX%%%Xxxxxxxx%%%%%',
    '%%%%xxxxX%%%XX%%%Xxxxxx%%%%%%%',
    '%%%%%XXXX%%%XX%%%XXXX%%%%%%%%%',
    '%%%%%X%%%%%%XX%%%%%%X%%%%%%%%%',
    '%%%%%X%%rr%%XX%%rr%%X%%%%%%%%%',
    '%%%%%XXXXXXXXXXXXXXXX%%%%%%%%%',
    '%%%%%X%%%%%%XX%%%%%%X%%%%%%%%%',
    '%%%%%XXXXX%%XX%%XXXXX%%%%%%%%%',
    '%%%%%xxxxX%%XX%%Xxxxx%%%%%%%%%',
    '%%%%%xxxxXXXXXXXXxxxx%%%%%%%%%',
    '%%%%%xxxxxxxXXxxxxxxx%%%%%%%%%',
    '%%%%%%%%%%%%22%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
  ],
  warps: {
    1: { to: 'stormridge', at: 5, look: 'X' },
    2: { to: 'tidefall', at: 6, look: 'X' },
  },
  spawn: { x: 13, y: 16 },
  npcs: [
    {
      id: 'cq_miner',
      x: 7, y: 5, sprite: 'man', dir: 'right',
      trainer: {
        name: 'Digger Halt', title: 'Digger', prize: 1000, ai: 3,
        team: [{ habitat: 'quarry', level: 21 }, { habitat: 'cave', level: 22 }],
        dialogue: {
          intro: 'Mind the ceiling and mind me.',
          defeat: 'Take the pick. Cracked rock comes down easy with it.',
          after: 'Stone hates water and roots. Remember that.',
        },
        reward: { item: 'pickaxe', qty: 1 },
      },
      questFlag: 'beat_halt',
    },
    {
      id: 'cq_lost',
      x: 18, y: 14, sprite: 'youth', dir: 'left',
      dialogue: ['I have been down here two days. There is a Dusk Orb merchant somewhere. I have not found him.'],
    },
  ],
  items: [
    { x: 6, y: 3, item: 'iron_core', qty: 1, flag: 'cq_core' },
    { x: 22, y: 4, item: 'nugget', qty: 1, flag: 'cq_nugget' },
    { x: 6, y: 16, item: 'duskorb', qty: 5, flag: 'cq_dusk' },
  ],
  encounters: {
    cave: {
      habitats: ['cave', 'quarry'],
      levels: [18, 24],
      featured: [
        { species: 'claybit', weight: 18 },
        { species: 'gravelump', weight: 14 },
        { species: 'sporeling', weight: 8 },
      ],
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Stormridge (Warden 3: Volt)
// ═══════════════════════════════════════════════════════════════════════════
map('stormridge', {
  name: 'Stormridge',
  music: 'town',
  outdoor: true,
  tiles: [
    '##############################',
    '####MMMMMMMMMM55MMMMMMMMMM####',
    '####M....................M####',
    '####M..OOOO....OOOO......M####',
    '####M..O==O....O==O......M####',
    '####M..O==O....O==O......M####',
    '####M..OO1O....OO2O......M####',
    '####M....................M####',
    '####M.pppppppppppppppppp.M####',
    '####M.p................p.M####',
    '####M.p...OOOO.........p.M####',
    '####M.p...O==O.........p.M####',
    '####M.p...O==O....S....p.M####',
    '####M.p...OO3O.........p.M####',
    '####M.p................p.M####',
    '####M.pppppppppppppppppp.M####',
    '####M..........pp........M####',
    '####MMMMMMMMMMM44MMMMMMMMM####',
    '##############################',
  ],
  warps: {
    1: { to: 'waystation_stormridge', at: 1, look: 'D' },
    2: { to: 'stormridge_shop', at: 1, look: 'D' },
    3: { to: 'storm_hall', at: 1, look: 'D' },
    4: { to: 'fen', at: 2, look: 'p' },
    5: { to: 'copper_quarry', at: 1, look: 'X' },
  },
  spawn: { x: 15, y: 16 },
  signs: [{ x: 18, y: 12, text: 'STORMRIDGE\nHigh, loud, and proud of it. Warden Kessa holds the Storm Hall.' }],
  npcs: [
    {
      id: 'sr_elder',
      x: 9, y: 9, sprite: 'elder', dir: 'down',
      dialogue: [
        'The Compact came asking to buy the ridge. Kessa laughed at them for a full minute.',
        'They have not come back politely since.',
      ],
    },
    {
      id: 'sr_tinker',
      x: 20, y: 14, sprite: 'aide', dir: 'left',
      script: 'move_relearner',
      dialogue: ['I can remind a creature of a move it has forgotten. For a fee, obviously.'],
    },
  ],
});

map('waystation_stormridge', {
  name: 'Stormridge Waystation',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__H_______b__|',
    '|_____C____b__|',
    '|_____C_______|',
    '|_____________|',
    '|__t_t____t_t_|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'stormridge', at: 1, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    { id: 'sr_nurse', x: 3, y: 1, sprite: 'nurse', dir: 'down', solid: true, healer: true },
    {
      id: 'sr_clerk', x: 5, y: 3, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['greatorb', 'ultraorb', 'superpotion', 'hyperpotion', 'revive', 'fullheal', 'maxrepel', 'timerorb'],
    },
    { id: 'sr_storage', x: 10, y: 5, sprite: 'terminal', dir: 'down', solid: true, storage: true },
  ],
});

map('stormridge_shop', {
  name: 'Ridge Outfitters',
  indoor: true,
  tiles: [
    '|||||||||||||',
    '|b__CCC___b_|',
    '|___________|',
    '|__t_____t__|',
    '|___________|',
    '|_____1_____|',
    '|||||||||||||',
  ],
  warps: { 1: { to: 'stormridge', at: 2, look: 'D' } },
  spawn: { x: 6, y: 4 },
  npcs: [
    {
      id: 'sr_shopkeep', x: 5, y: 1, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['lifeorb', 'choiceband', 'choicespecs', 'choicescarf', 'assaultvest', 'eviolite', 'volt_gem', 'tome_voltbeam', 'tome_calmmind', 'tome_bulkup', 'xattack', 'xspeed'],
    },
    {
      id: 'sr_trainer', x: 9, y: 3, sprite: 'woman', dir: 'left',
      script: 'vitamin_seller',
      dialogue: ['Draughts sharpen a creature permanently. Expensive, but the effect never fades.'],
    },
  ],
});

map('storm_hall', {
  name: 'Storm Hall',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__G_G_G_G_G__|',
    '|_____________|',
    '|__G__***__G__|',
    '|_____________|',
    '|__G_G_G_G_G__|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'stormridge', at: 3, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    {
      id: 'storm_aide',
      x: 11, y: 6, sprite: 'aide', dir: 'left',
      trainer: {
        name: 'Linesman Kob', title: 'Linesman', prize: 1400, ai: 4,
        team: [{ habitat: 'stormcoast', level: 26 }, { habitat: 'facility', level: 27 }],
        dialogue: {
          intro: 'Kessa does not see anyone who cannot beat a linesman.',
          defeat: 'Fine. She is waiting.',
          after: 'Stone eats Volt alive. Bring something with dirt on it.',
        },
      },
    },
    {
      id: 'warden_kessa',
      x: 7, y: 2, sprite: 'warden_volt', dir: 'down', solid: true,
      script: 'warden_volt',
    },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Fen of Sighs → Ashfall (Warden 4: Ember)
// ═══════════════════════════════════════════════════════════════════════════
map('fen', {
  name: 'Fen of Sighs',
  music: 'marsh',
  outdoor: true,
  tiles: [
    '##############################',
    '####.........11..........#####',
    '####..mmmm...pp...mmmm...#####',
    '####.mmmmmm..pp..mmmmmm..#####',
    '####.mmmmmm..pp..mmmmmm..#####',
    '####.mmm~~mm.pp.mm~~mmm..#####',
    '####.mm~~~~m.pp.m~~~~mm..#####',
    '####.mmm~~mm.pp.mm~~mmm..#####',
    '####.mmmmmm..pp..mmmmmm..#####',
    '####..mmmm...pp...mmmm...#####',
    '####.........pp..........#####',
    '####..mmmm...pp...S......#####',
    '####.mmmmmm..pp..mmmm....#####',
    '####.mmmmmm..pp..mmmm....#####',
    '####..mmmm...pp...mmmm...#####',
    '####.........pp..........#####',
    '####.........22..........#####',
    '##############################',
  ],
  warps: {
    1: { to: 'ashfall', at: 4, look: 'p' },
    2: { to: 'stormridge', at: 4, look: 'p' },
  },
  spawn: { x: 13, y: 15 },
  signs: [{ x: 18, y: 11, text: 'FEN OF SIGHS\nStay on the causeway. The fen keeps what steps off it.' }],
  npcs: [
    {
      id: 'fen_witch',
      x: 8, y: 10, sprite: 'elder', dir: 'right',
      trainer: {
        name: 'Fenwife Alder', title: 'Fenwife', prize: 1600, ai: 4,
        team: [{ habitat: 'marsh', level: 29 }, { habitat: 'marsh', level: 30 }, { species: 'sporeling', level: 30 }],
        dialogue: {
          intro: 'The fen does not like company. Neither do I.',
          defeat: 'Hm. Take a candle. It burns for the dead, but it will do for you.',
          after: 'Some creatures only wake up properly at a graveside. Try the candle on one.',
        },
        reward: { item: 'grave_candle', qty: 1 },
      },
      questFlag: 'beat_alder',
    },
    {
      id: 'fen_compact',
      x: 18, y: 4, sprite: 'compact', dir: 'down',
      trainer: {
        name: 'Compact Hand Sirr', title: 'Cinder Compact', prize: 1500, ai: 4,
        team: [{ species: 'ashstalker', level: 30 }, { habitat: 'sewer', level: 29 }],
        dialogue: {
          intro: 'The fen is thick with loose Weave. Perfect harvesting.',
          defeat: 'The Ashfall site is bigger than this. You cannot be everywhere.',
          after: 'Ashfall. That is where it matters. Go and see.',
        },
      },
      questFlag: 'compact_fen',
    },
  ],
  items: [{ x: 6, y: 6, item: 'bigpearl', qty: 1, flag: 'fen_pearl' }],
  encounters: {
    marsh: {
      habitats: ['marsh', 'forest'],
      levels: [26, 32],
      featured: [{ species: 'sporeling', weight: 14 }, { species: 'wispling', weight: 10 }],
    },
    water: { habitats: ['marsh', 'river'], levels: [26, 32] },
  },
});

map('ashfall', {
  name: 'Ashfall',
  music: 'town',
  outdoor: true,
  tiles: [
    '##############################',
    '####MMMMMMMMMM55MMMMMMMMMM####',
    '####M.aaaaaaaaaaaaaaaaaa.M####',
    '####M.a..OOOO...OOOO...a.M####',
    '####M.a..O==O...O==O...a.M####',
    '####M.a..O==O...O==O...a.M####',
    '####M.a..OO1O...OO2O...a.M####',
    '####M.a................a.M####',
    '####M.appppppppppppppppa.M####',
    '####M.ap..............pa.M####',
    '####M.ap...OOOOOO.....pa.M####',
    '####M.ap...O====O.....pa.M####',
    '####M.ap...O====O..S..pa.M####',
    '####M.ap...OOO3OO.....pa.M####',
    '####M.ap..............pa.M####',
    '####M.appppppppppppppppa.M####',
    '####M.aaaaaaaa44aaaaaaaa.M####',
    '####MMMMMMMMMMMMMMMMMMMMMM####',
    '##############################',
  ],
  warps: {
    1: { to: 'waystation_ashfall', at: 1, look: 'D' },
    2: { to: 'ashfall_shop', at: 1, look: 'D' },
    3: { to: 'ember_hall', at: 1, look: 'D' },
    4: { to: 'fen', at: 1, look: 'a' },
    5: { to: 'sunken_archive', at: 3, look: 'a' },
  },
  spawn: { x: 15, y: 15 },
  signs: [{ x: 19, y: 12, text: 'ASHFALL\nBuilt on a vent that has never once gone out. Warden Bruhn keeps the Ember Hall.' }],
  npcs: [
    {
      id: 'af_smith',
      x: 8, y: 9, sprite: 'man', dir: 'right',
      script: 'forge_smith',
      dialogue: ['Bring me scrap metal and I will make you something worth holding.'],
    },
    {
      id: 'af_watcher',
      x: 20, y: 14, sprite: 'woman', dir: 'left',
      dialogue: [
        'The Compact bought the old vent works. Nobody signed anything. They simply arrived.',
        'Bruhn has been down there twice. He will not say what he saw.',
      ],
    },
  ],
  encounters: {
    volcano: { habitats: ['volcano', 'forge'], levels: [30, 36], featured: [{ species: 'emberkit', weight: 3 }] },
  },
});

map('waystation_ashfall', {
  name: 'Ashfall Waystation',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__H_______b__|',
    '|_____C____b__|',
    '|_____C_______|',
    '|_____________|',
    '|__t_t____t_t_|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'ashfall', at: 1, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    { id: 'af_nurse', x: 3, y: 1, sprite: 'nurse', dir: 'down', solid: true, healer: true },
    {
      id: 'af_clerk', x: 5, y: 3, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['ultraorb', 'hyperpotion', 'fullrestore', 'revive', 'maxrevive', 'fullheal', 'maxrepel', 'healorb'],
    },
    { id: 'af_storage', x: 10, y: 5, sprite: 'terminal', dir: 'down', solid: true, storage: true },
  ],
});

map('ashfall_shop', {
  name: 'Vent Works Supply',
  indoor: true,
  tiles: [
    '|||||||||||||',
    '|b__CCC___b_|',
    '|___________|',
    '|__t_____t__|',
    '|___________|',
    '|_____1_____|',
    '|||||||||||||',
  ],
  warps: { 1: { to: 'ashfall', at: 2, look: 'D' } },
  spawn: { x: 6, y: 4 },
  npcs: [
    {
      id: 'af_shopkeep', x: 5, y: 1, sprite: 'clerk', dir: 'down', solid: true,
      shop: ['flame_shard', 'tide_stone', 'moss_stone', 'storm_shard', 'frost_shard', 'dawn_stone', 'dusk_stone', 'iron_core', 'ember_gem', 'naturemint', 'abilitycapsule'],
    },
    {
      id: 'af_vitamins', x: 9, y: 3, sprite: 'clerk', dir: 'left',
      shop: ['hpup', 'protein', 'iron', 'calcium', 'zinc', 'carbos', 'friendbell'],
    },
  ],
});

map('ember_hall', {
  name: 'Ember Hall',
  indoor: true,
  tiles: [
    '|||||||||||||||',
    '|__aaaaaaaaa__|',
    '|__a_______a__|',
    '|__a__***__a__|',
    '|__a_______a__|',
    '|__aaaaaaaaa__|',
    '|_____________|',
    '|______1______|',
    '|||||||||||||||',
  ],
  warps: { 1: { to: 'ashfall', at: 3, look: 'D' } },
  spawn: { x: 7, y: 6 },
  npcs: [
    {
      id: 'ember_aide',
      x: 3, y: 6, sprite: 'aide', dir: 'right',
      trainer: {
        name: 'Stoker Vane', title: 'Stoker', prize: 2000, ai: 4,
        team: [{ habitat: 'forge', level: 34 }, { habitat: 'volcano', level: 35 }],
        dialogue: {
          intro: 'Hot in here. Stays hot. Ready?',
          defeat: 'Bruhn is through the arch.',
          after: 'Stone and Tide put out fire. So does keeping your head.',
        },
      },
    },
    {
      id: 'warden_bruhn',
      x: 7, y: 2, sprite: 'warden_ember', dir: 'down', solid: true,
      script: 'warden_ember',
    },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Endgame: Sunken Archive → Riftmouth, plus Heartwood
// ═══════════════════════════════════════════════════════════════════════════
map('sunken_archive', {
  name: 'Sunken Archive',
  music: 'ruins',
  cave: true,
  tiles: [
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%11%%%%%%%%%%%%%%%%',
    '%%%XXXXX%%%%XX%%%%XXXXXXX%%%%%',
    '%%%X***X%%%%XX%%%%X*****X%%%%%',
    '%%%X***XXXXXXXXXXXX*****X%%%%%',
    '%%%X***X%%%%XX%%%%X*****X%%%%%',
    '%%%XXXXX%%%%XX%%%%XXXXXXX%%%%%',
    '%%%%%%X%%%%%XX%%%%%%X%%%%%%%%%',
    '%%%%%%XXXXXXXXXXXXXXX%%%%%%%%%',
    '%%%%%%X%%%%%XX%%%%%%X%%%%%%%%%',
    '%%%%%%X%%xxxXXxxx%%%X%%%%%%%%%',
    '%%%%%%X%%xxxXXxxx%%%X%%%%%%%%%',
    '%%%%%%XXXXXXXXXXXXXXX%%%%%%%%%',
    '%%%%%%%%%%%%XX%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%33%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
  ],
  warps: {
    1: { to: 'riftmouth', at: 1, look: 'X' },
    3: { to: 'ashfall', at: 5, look: 'X' },
  },
  spawn: { x: 13, y: 13 },
  npcs: [
    {
      id: 'sa_scholar',
      x: 6, y: 4, sprite: 'aide', dir: 'right',
      script: 'archive_scholar',
    },
    {
      id: 'sa_compact',
      x: 19, y: 4, sprite: 'compact_officer', dir: 'left',
      trainer: {
        name: 'Compact Adept Yreni', title: 'Cinder Compact', prize: 3000, ai: 4,
        team: [
          { species: 'ashstalker', level: 40 },
          { species: 'snarlweave', level: 41 },
          { habitat: 'ruins', level: 40 },
        ],
        dialogue: {
          intro: 'The Archive says the Weave can be cut. We simply read further than the Wardens did.',
          defeat: 'Read the last page, then. See if you still want to stop us.',
          after: 'The Riftmouth is north. Bring everything you have.',
        },
      },
      questFlag: 'archive_cleared',
    },
  ],
  items: [
    { x: 5, y: 3, item: 'riftglass', qty: 1, flag: 'sa_riftglass' },
    { x: 21, y: 5, item: 'starpiece', qty: 1, flag: 'sa_star' },
  ],
  encounters: {
    cave: { habitats: ['ruins', 'library'], levels: [36, 42], featured: [{ species: 'inkling', weight: 12 }, { species: 'mindmite', weight: 12 }] },
  },
});

map('riftmouth', {
  name: 'The Riftmouth',
  music: 'rift',
  cave: true,
  tiles: [
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%!!!!!!%%%%%%%%%%%%%%',
    '%%%%%%%%!!!!!!!!!!%%%%%%%%%%%%',
    '%%%%%%%!!!!!**!!!!!%%%%%%%%%%%',
    '%%%%%%!!!!***!***!!!%%%%%%%%%%',
    '%%%%%%!!!!!**!!!!!!!%%%%%%%%%%',
    '%%%%%%%!!!!!XX!!!!!%%%%%%%%%%%',
    '%%%%%%%%!!!!XX!!!!%%%%%%%%%%%%',
    '%%%%%%%%%!!!XX!!!%%%%%%%%%%%%%',
    '%%%%%%%%%%%!XX!%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%XX%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%XX%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%11%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
  ],
  warps: { 1: { to: 'sunken_archive', at: 1, look: 'X' } },
  spawn: { x: 13, y: 12 },
  npcs: [
    {
      id: 'rift_hollis',
      x: 13, y: 5, sprite: 'compact_leader', dir: 'down', solid: true,
      script: 'final_confrontation',
    },
  ],
  encounters: {
    rift: { habitats: ['rift', 'ruins'], levels: [42, 48], featured: [{ species: 'frayling', weight: 16 }] },
  },
});

map('heartwood', {
  name: 'The Heartwood',
  music: 'heartwood',
  outdoor: true,
  tiles: [
    '##############################',
    '####TTTTTTTTTTTTTTTTTTTTTT####',
    '####T"""""""""""""""""""" T###',
    '####T""ffff""""""ffff"""""T###',
    '####T"""""""""""""""""""""T###',
    '####T"""""***********"""""T###',
    '####T"""""*         *"""""T###',
    '####T"""""* ooooooo *"""""T###',
    '####T"""""*         *"""""T###',
    '####T"""""***********"""""T###',
    '####T"""""""""""""""""""""T###',
    '####T""ffff""""""ffff"""""T###',
    '####T"""""""""""""""""""""T###',
    '####TTTTTTTTTT11TTTTTTTTTTT###',
    '##############################',
  ],
  warps: { 1: { to: 'emberwood', at: 5, look: '.' } },
  spawn: { x: 15, y: 12 },
  npcs: [
    {
      id: 'heartwood_sylvara',
      x: 15, y: 7, sprite: 'legendary', dir: 'down', solid: true,
      script: 'legendary_sylvara',
    },
  ],
  encounters: {
    grass_rare: { habitats: ['heartwood', 'forest'], levels: [44, 50], featured: [{ species: 'elderbloom', weight: 4 }] },
  },
});

/** Replaces spaces (used for readability in a couple of maps) with floor. */
for (const id in MAPS) {
  MAPS[id].tiles = MAPS[id].tiles.map((row) => row.replace(/ /g, MAPS[id].indoor ? '_' : '.'));
}

export function getMap(id) {
  return MAPS[id] || null;
}

export const MAP_IDS = Object.keys(MAPS);
