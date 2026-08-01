// Hand-authored evolution families: the starters, the Warden aces, the
// story creatures and the legendaries. The rest of the roster is generated
// deterministically in speciesgen.js from the same node shape.
//
// Node shape:
//   n     display name
//   t     type list (1 or 2)
//   plan  body plan, drives the procedural sprite
//   b     [hp, atk, def, spa, spd, spe] base stats
//   ab    normal abilities (1-2)
//   ha    hidden ability
//   dex   dex entry
//   sig   signature move added to the learnset at the top of its range
//   moves extra guaranteed learnset entries, [level, moveId]
//   evo   children; each carries a `req` describing how it is reached
//
// Requirement shapes:
//   { lv: 16 }                       level up
//   { lv: 30, cond: 'atk>spa' }      level up with a stat comparison
//   { lv: 30, cond: 'night' }        level up at night (in-game clock)
//   { lv: 30, cond: 'day' }          level up in daylight
//   { item: 'flame_shard' }          use an evolution item
//   { friendship: 200 }              level up with high friendship
//   { lv: 40, cond: 'holding:x' }    level up holding an item

const FAMILIES = [];

function fam(id, opts) {
  FAMILIES.push({ id, ...opts });
}

// ── Starters ───────────────────────────────────────────────────────────────
fam('emberkit', {
  rarity: 'starter',
  habitat: ['starter'],
  root: {
    n: 'Emberkit', t: ['ember'], plan: 'quadruped', b: [48, 62, 44, 58, 46, 66],
    ab: ['blaze'], ha: 'kindler',
    dex: 'A hearth-born pup. It sleeps in ash and wakes when the fire is poked.',
    moves: [[1, 'scratch'], [1, 'growl'], [7, 'ember'], [13, 'firefang']],
    evo: [
      {
        req: { lv: 17 },
        n: 'Flarehound', t: ['ember'], plan: 'quadruped', b: [68, 86, 62, 78, 64, 92],
        ab: ['blaze'], ha: 'cinderskin',
        dex: 'It runs a circuit of its territory each dusk, leaving scorched paw prints.',
        moves: [[20, 'flamelash'], [26, 'howl']],
        evo: [
          {
            req: { lv: 36, cond: 'atk>=spa' },
            n: 'Pyrelord', t: ['ember', 'beast'], plan: 'quadruped', b: [92, 128, 88, 92, 84, 112],
            ab: ['blaze', 'bruiser'], ha: 'intimidate',
            dex: 'The pack answers to it. So, mostly, does the fire.',
            moves: [[42, 'flarepunch'], [50, 'rampage']],
          },
          {
            req: { lv: 36, cond: 'spa>atk' },
            n: 'Cinderwraith', t: ['ember', 'spirit'], plan: 'floater', b: [88, 86, 82, 132, 96, 112],
            ab: ['blaze', 'flamedrink'], ha: 'cursedtouch',
            dex: 'What is left when a hearth outlives the house it warmed.',
            moves: [[42, 'pyreblast'], [50, 'soulrend']],
          },
        ],
      },
    ],
  },
});

fam('puddlet', {
  rarity: 'starter',
  habitat: ['starter'],
  root: {
    n: 'Puddlet', t: ['tide'], plan: 'amorphous', b: [56, 50, 60, 58, 58, 42],
    ab: ['torrent'], ha: 'waterwell',
    dex: 'Fits itself to any container. Prefers boots.',
    moves: [[1, 'splash'], [1, 'harden'], [7, 'bubblebeam'], [13, 'mistveil']],
    evo: [
      {
        req: { lv: 17 },
        n: 'Brookend', t: ['tide'], plan: 'aquatic', b: [78, 68, 84, 80, 82, 60],
        ab: ['torrent'], ha: 'raindrink',
        dex: 'It dams small streams for reasons it will not explain.',
        moves: [[20, 'watercannon'], [26, 'whirlpool']],
        evo: [
          {
            req: { lv: 36, cond: 'day' },
            n: 'Tidewarden', t: ['tide', 'stone'], plan: 'aquatic', b: [112, 92, 128, 96, 112, 62],
            ab: ['torrent', 'sturdy'], ha: 'multiscale',
            dex: 'Old harbours keep one. Old harbours keep standing.',
            moves: [[42, 'tidalcrash'], [50, 'stonewall']],
          },
          {
            req: { lv: 36, cond: 'night' },
            n: 'Drownbell', t: ['tide', 'spirit'], plan: 'floater', b: [96, 70, 96, 126, 118, 96],
            ab: ['torrent', 'cursedtouch'], ha: 'leech',
            dex: 'It rings once for every ship the bay has kept.',
            moves: [[42, 'maelstrom'], [50, 'memorial']],
          },
        ],
      },
    ],
  },
});

fam('sprigling', {
  rarity: 'starter',
  habitat: ['starter'],
  root: {
    n: 'Sprigling', t: ['verdant'], plan: 'plant', b: [52, 54, 56, 62, 58, 44],
    ab: ['overgrow'], ha: 'rootfeed',
    dex: 'It plants itself when nervous, which is often.',
    moves: [[1, 'vinewhip'], [1, 'leer'], [7, 'absorb'], [13, 'leechseed']],
    evo: [
      {
        req: { lv: 17 },
        n: 'Thornward', t: ['verdant'], plan: 'plant', b: [74, 76, 80, 84, 78, 62],
        ab: ['overgrow'], ha: 'barbskin',
        dex: 'It grows a fence around whatever it decides to protect.',
        moves: [[20, 'razorleaf'], [26, 'growth']],
        evo: [
          {
            req: { lv: 36, cond: 'atk>=spa' },
            n: 'Bramblejaw', t: ['verdant', 'beast'], plan: 'quadruped', b: [102, 124, 104, 76, 90, 88],
            ab: ['overgrow', 'barbskin'], ha: 'guts',
            dex: 'The thicket that learned to hunt back.',
            moves: [[42, 'worldsplit'], [50, 'crunch']],
          },
          {
            req: { lv: 36, cond: 'spa>atk' },
            n: 'Elderbloom', t: ['verdant', 'radiant'], plan: 'plant', b: [104, 74, 100, 128, 116, 62],
            ab: ['overgrow', 'photosynth'], ha: 'worldroot',
            dex: 'It opens at first light and closes over anything that needs shelter.',
            moves: [[42, 'bloomburst'], [50, 'blessing']],
          },
        ],
      },
    ],
  },
});

// ── Early-route staples ────────────────────────────────────────────────────
fam('nibbet', {
  rarity: 'common',
  habitat: ['grass_early', 'town'],
  root: {
    n: 'Nibbet', t: ['beast'], plan: 'quadruped', b: [42, 46, 40, 32, 36, 58],
    ab: ['forager'], ha: 'guts',
    dex: 'It has eaten through three of the mayor\'s fences and shows no remorse.',
    moves: [[1, 'tackle'], [4, 'growl'], [10, 'nip']],
    evo: [
      {
        req: { lv: 18 },
        n: 'Gnawmore', t: ['beast'], plan: 'quadruped', b: [70, 82, 66, 44, 58, 88],
        ab: ['forager', 'bruiser'], ha: 'guts',
        dex: 'Chews on stone to keep its teeth honest.',
        moves: [[24, 'crunch'], [32, 'bodyslam']],
        evo: [
          {
            req: { lv: 34 },
            n: 'Grandgnaw', t: ['beast', 'stone'], plan: 'quadruped', b: [96, 116, 102, 56, 82, 104],
            ab: ['bruiser', 'sturdy'], ha: 'thickhide',
            dex: 'Its den is a tunnel through a mountain it did not intend to make.',
            moves: [[40, 'quake'], [46, 'maul']],
          },
        ],
      },
    ],
  },
});

fam('flittle', {
  rarity: 'common',
  habitat: ['grass_early', 'forest'],
  root: {
    n: 'Flittle', t: ['gale'], plan: 'avian', b: [40, 44, 36, 38, 36, 64],
    ab: ['keeneye'], ha: 'slipstream',
    dex: 'Too curious to stay in a tree. Too small to be anywhere else.',
    moves: [[1, 'gust'], [5, 'leer'], [11, 'wingbeat']],
    evo: [
      {
        req: { lv: 16 },
        n: 'Wingle', t: ['gale'], plan: 'avian', b: [62, 70, 56, 58, 56, 92],
        ab: ['keeneye'], ha: 'slipstream',
        dex: 'It memorises the whole valley by the third week of its life.',
        moves: [[22, 'aircutter'], [28, 'agility']],
        evo: [
          {
            req: { lv: 33 },
            n: 'Skyreave', t: ['gale', 'beast'], plan: 'avian', b: [84, 110, 76, 82, 78, 126],
            ab: ['keeneye', 'intimidate'], ha: 'firststrike',
            dex: 'The shadow crossing the road is usually it, and usually already past.',
            moves: [[38, 'divebomb'], [48, 'skysplitter']],
          },
        ],
      },
    ],
  },
});

fam('mothlet', {
  rarity: 'common',
  habitat: ['grass_early', 'forest'],
  root: {
    n: 'Mothlet', t: ['insect'], plan: 'insectoid', b: [45, 38, 42, 36, 40, 40],
    ab: ['swarmcall'], ha: 'compound',
    dex: 'It navigates by lamplight and is therefore frequently lost indoors.',
    moves: [[1, 'stingshot'], [6, 'silkwrap']],
    evo: [
      {
        req: { lv: 12 },
        n: 'Cocoonet', t: ['insect'], plan: 'insectoid', b: [62, 36, 82, 36, 78, 26],
        ab: ['shedskin'], ha: 'sturdy',
        dex: 'Nothing happens here for a while. A great deal is happening here.',
        moves: [[12, 'harden'], [14, 'carapace']],
        evo: [
          {
            req: { lv: 24, cond: 'day' },
            n: 'Lumamoth', t: ['insect', 'radiant'], plan: 'insectoid', b: [78, 60, 76, 118, 100, 96],
            ab: ['compound', 'prismskin'], ha: 'dawnbringer',
            dex: 'Its wing-dust catches the sun and keeps a little of it.',
            moves: [[30, 'dawnbreak'], [42, 'psybug']],
          },
          {
            req: { lv: 24, cond: 'night' },
            n: 'Duskmoth', t: ['insect', 'umbra'], plan: 'insectoid', b: [78, 96, 76, 96, 84, 114],
            ab: ['compound', 'slipstream'], ha: 'nightmantle',
            dex: 'It eats moonlight, or at least it eats where moonlight has been.',
            moves: [[30, 'darkpulse'], [42, 'devourbite']],
          },
        ],
      },
    ],
  },
});

// ── Warden aces and mid-game anchors ───────────────────────────────────────
fam('claybit', {
  rarity: 'common',
  habitat: ['cave', 'quarry'],
  root: {
    n: 'Claybit', t: ['stone'], plan: 'construct', b: [58, 62, 78, 32, 44, 30],
    ab: ['sturdy'], ha: 'duststorm',
    dex: 'A handful of the road that decided to keep walking.',
    moves: [[1, 'rockthrow'], [8, 'harden'], [15, 'sandsong']],
    evo: [
      {
        req: { lv: 22 },
        n: 'Menhir', t: ['stone'], plan: 'construct', b: [86, 92, 118, 44, 66, 34],
        ab: ['sturdy', 'ironwall'], ha: 'duststorm',
        dex: 'Farmers mark their fields with them. The marks move.',
        moves: [[28, 'boulderdrop'], [34, 'stonewall']],
        evo: [
          {
            req: { lv: 40 },
            n: 'Cairnking', t: ['stone', 'spirit'], plan: 'construct', b: [116, 118, 152, 62, 96, 36],
            ab: ['sturdy', 'ironwall'], ha: 'grudge',
            dex: 'Every stone in it was placed by somebody who wanted to be remembered.',
            moves: [[46, 'tectonic'], [52, 'phantomgrip']],
          },
          {
            req: { item: 'iron_core' },
            n: 'Forgewright', t: ['stone', 'metal'], plan: 'construct', b: [104, 132, 138, 68, 84, 58],
            ab: ['ironwall', 'heavyhitter'], ha: 'sturdy',
            dex: 'It builds. Given time and no instructions, it builds a road.',
            moves: [[46, 'gearpunch'], [52, 'bladestorm']],
          },
        ],
      },
    ],
  },
});

fam('voltpup', {
  rarity: 'uncommon',
  habitat: ['grass_mid', 'stormcoast'],
  root: {
    n: 'Voltpup', t: ['volt'], plan: 'quadruped', b: [46, 52, 42, 66, 48, 78],
    ab: ['staticfield'], ha: 'conductor',
    dex: 'Sheds sparks when happy, which makes it a poor houseguest.',
    moves: [[1, 'spark'], [9, 'shockwave'], [16, 'chargeup']],
    evo: [
      {
        req: { lv: 26 },
        n: 'Arcmane', t: ['volt'], plan: 'quadruped', b: [72, 76, 64, 106, 74, 116],
        ab: ['staticfield', 'rainrunner'], ha: 'conductor',
        dex: 'Its mane stands up an hour before any storm arrives.',
        moves: [[32, 'voltbeam'], [40, 'thunderclap']],
        evo: [
          {
            req: { item: 'storm_shard' },
            n: 'Tempestrider', t: ['volt', 'gale'], plan: 'quadruped', b: [92, 96, 82, 138, 96, 142],
            ab: ['rainrunner', 'cloudcaller'], ha: 'conductor',
            dex: 'It does not outrun the storm. It arrives with it.',
            moves: [[48, 'stormsurge'], [56, 'cyclone']],
          },
        ],
      },
    ],
  },
});

fam('frostkit', {
  rarity: 'uncommon',
  habitat: ['tundra', 'peaks'],
  root: {
    n: 'Frostkit', t: ['frost'], plan: 'quadruped', b: [50, 54, 50, 60, 56, 58],
    ab: ['icebody'], ha: 'coldblooded',
    dex: 'Its breath frosts the window from the outside.',
    moves: [[1, 'chill'], [8, 'iceshard'], [15, 'frostarmor']],
    evo: [
      {
        req: { lv: 25 },
        n: 'Rimewolf', t: ['frost'], plan: 'quadruped', b: [76, 88, 74, 88, 80, 92],
        ab: ['icebody', 'snowcoat'], ha: 'coldblooded',
        dex: 'It walks on the crust of the snow without breaking it.',
        moves: [[30, 'icefang'], [38, 'rimewalk']],
        evo: [
          {
            req: { lv: 44 },
            n: 'Hoarfang', t: ['frost', 'umbra'], plan: 'quadruped', b: [102, 128, 96, 112, 104, 118],
            ab: ['snowmaker', 'snowcoat'], ha: 'intimidate',
            dex: 'The long winter has a shape, and this is it.',
            moves: [[50, 'permafrost'], [58, 'voidfang']],
          },
        ],
      },
    ],
  },
});

fam('inkling', {
  rarity: 'uncommon',
  habitat: ['ruins', 'library'],
  root: {
    n: 'Inkling', t: ['umbra'], plan: 'amorphous', b: [44, 48, 46, 68, 56, 62],
    ab: ['stealthstep'], ha: 'shadeeater',
    dex: 'Made of a sentence somebody crossed out.',
    moves: [[1, 'nightsting'], [10, 'feint'], [18, 'taunt']],
    evo: [
      {
        req: { lv: 28 },
        n: 'Marginal', t: ['umbra', 'mind'], plan: 'floater', b: [66, 68, 66, 106, 84, 96],
        ab: ['stealthstep', 'prankster'], ha: 'shadeeater',
        dex: 'It lives in the space around what was written, and reads it constantly.',
        moves: [[34, 'darkpulse'], [40, 'nastyplot']],
        evo: [
          {
            req: { lv: 46 },
            n: 'Palimpsest', t: ['umbra', 'mind'], plan: 'floater', b: [88, 84, 88, 146, 112, 124],
            ab: ['prankster', 'unravel'], ha: 'nightmantle',
            dex: 'Everything ever scraped off a page, kept in one polite shape.',
            moves: [[52, 'eclipse'], [60, 'mindbreak']],
          },
        ],
      },
    ],
  },
});

fam('emberling_forge', {
  rarity: 'uncommon',
  habitat: ['forge', 'volcano'],
  root: {
    n: 'Slagling', t: ['ember', 'metal'], plan: 'construct', b: [54, 68, 74, 58, 52, 40],
    ab: ['magmaheart'], ha: 'ironwall',
    dex: 'Skimmed off the top of a crucible and never thrown away.',
    moves: [[1, 'ember'], [12, 'metalclaw'], [20, 'harden']],
    evo: [
      {
        req: { lv: 30 },
        n: 'Bellowbeast', t: ['ember', 'metal'], plan: 'construct', b: [86, 106, 112, 84, 78, 52],
        ab: ['magmaheart', 'kindler'], ha: 'ironwall',
        dex: 'It breathes for the forge when the smith sleeps.',
        moves: [[36, 'ironhead'], [44, 'flamethrower']],
        evo: [
          {
            req: { lv: 48 },
            n: 'Crucibrand', t: ['ember', 'metal'], plan: 'construct', b: [112, 142, 138, 108, 96, 60],
            ab: ['kindler', 'heavyhitter'], ha: 'magmaheart',
            dex: 'What the forge would be if the forge could walk to you.',
            moves: [[54, 'flarepunch'], [62, 'bladestorm']],
          },
        ],
      },
    ],
  },
});

fam('sporeling', {
  rarity: 'common',
  habitat: ['forest', 'cave'],
  root: {
    n: 'Sporeling', t: ['toxin', 'verdant'], plan: 'plant', b: [50, 44, 52, 62, 60, 34],
    ab: ['toxicskin'], ha: 'immunity',
    dex: 'It grows where the light does not reach and is very pleased about it.',
    moves: [[1, 'absorb'], [9, 'poisonsting'], [17, 'sporecloud']],
    evo: [
      {
        req: { lv: 24 },
        n: 'Mycelian', t: ['toxin', 'verdant'], plan: 'plant', b: [82, 62, 78, 96, 92, 44],
        ab: ['toxicskin', 'poisonheal'], ha: 'regenerator',
        dex: 'Half of it is underground, and that half is much larger.',
        moves: [[30, 'sludgewave'], [38, 'megadrain']],
        evo: [
          {
            req: { lv: 42, cond: 'night' },
            n: 'Rotcrown', t: ['toxin', 'spirit'], plan: 'plant', b: [108, 82, 96, 130, 118, 52],
            ab: ['poisonheal', 'leech'], ha: 'cursedtouch',
            dex: 'It takes what the forest is finished with, and asks for a little more.',
            moves: [[48, 'toxicbloom'], [56, 'hex']],
          },
        ],
      },
    ],
  },
});

fam('mindmite', {
  rarity: 'uncommon',
  habitat: ['ruins', 'academy'],
  root: {
    n: 'Mindmite', t: ['mind'], plan: 'floater', b: [42, 34, 42, 74, 66, 62],
    ab: ['clearmind'], ha: 'prankster',
    dex: 'It hovers at the edge of your thinking and hums along.',
    moves: [[1, 'psywave'], [10, 'confuse'], [18, 'calmmind']],
    evo: [
      {
        req: { lv: 27 },
        n: 'Cogitant', t: ['mind'], plan: 'floater', b: [66, 50, 66, 116, 100, 92],
        ab: ['clearmind', 'download'], ha: 'unaware',
        dex: 'Answers questions you have not finished asking, sometimes correctly.',
        moves: [[34, 'psystrike'], [40, 'lightscreen']],
        evo: [
          {
            req: { friendship: 200 },
            n: 'Aetherseer', t: ['mind', 'radiant'], plan: 'floater', b: [92, 62, 88, 152, 128, 108],
            ab: ['clearmind', 'dawnbringer'], ha: 'sovereign',
            dex: 'It can see the Weave. It is trying, very hard, to describe it to you.',
            moves: [[48, 'judgement'], [58, 'mindbreak']],
          },
        ],
      },
    ],
  },
});

fam('shellcrab', {
  rarity: 'common',
  habitat: ['coast', 'harbor'],
  root: {
    n: 'Shellnip', t: ['tide'], plan: 'arachnid', b: [48, 66, 74, 32, 44, 46],
    ab: ['sturdy'], ha: 'waterwell',
    dex: 'Wears whatever fits. Currently: half a teapot.',
    moves: [[1, 'nip'], [8, 'harden'], [14, 'bubblebeam']],
    evo: [
      {
        req: { lv: 26 },
        n: 'Bulwark', t: ['tide', 'metal'], plan: 'arachnid', b: [78, 106, 122, 46, 74, 58],
        ab: ['sturdy', 'ironwall'], ha: 'waterwell',
        dex: 'Harbour crews rent them by the hour to hold doors shut.',
        moves: [[32, 'metalclaw'], [40, 'platingup']],
        evo: [
          {
            req: { lv: 44 },
            n: 'Portmaster', t: ['tide', 'metal'], plan: 'arachnid', b: [104, 138, 152, 62, 98, 66],
            ab: ['ironwall', 'thickhide'], ha: 'sturdy',
            dex: 'It has decided which ships may dock. Nobody has overruled it yet.',
            moves: [[50, 'gearpunch'], [58, 'tidalcrash']],
          },
        ],
      },
    ],
  },
});

fam('wispling', {
  rarity: 'uncommon',
  habitat: ['graveyard', 'ruins'],
  root: {
    n: 'Wispling', t: ['spirit'], plan: 'floater', b: [40, 36, 40, 72, 62, 74],
    ab: ['cursedtouch'], ha: 'stealthstep',
    dex: 'A small errand somebody died before finishing.',
    moves: [[1, 'wisp'], [10, 'willowisp'], [17, 'shadowveil']],
    evo: [
      {
        req: { lv: 29 },
        n: 'Lanternward', t: ['spirit'], plan: 'floater', b: [64, 52, 66, 112, 96, 104],
        ab: ['cursedtouch', 'leech'], ha: 'nightmantle',
        dex: 'It walks travellers home. It does not always know which home.',
        moves: [[36, 'soulrend'], [42, 'memorial']],
        evo: [
          {
            req: { item: 'grave_candle' },
            n: 'Vigilbearer', t: ['spirit', 'radiant'], plan: 'floater', b: [92, 70, 92, 148, 126, 116],
            ab: ['leech', 'dawnbringer'], ha: 'worldroot',
            dex: 'It has kept one light burning for four hundred years. It is not tired.',
            moves: [[50, 'lastrites'], [58, 'blessing']],
          },
        ],
      },
    ],
  },
});

fam('scaleling', {
  rarity: 'rare',
  habitat: ['peaks', 'volcano'],
  root: {
    n: 'Scaleling', t: ['beast'], plan: 'draconic', b: [56, 66, 60, 62, 58, 52],
    ab: ['thickhide'], ha: 'multiscale',
    dex: 'It practises roaring. The results are improving slowly.',
    moves: [[1, 'nip'], [12, 'headbutt'], [22, 'bulkup']],
    evo: [
      {
        req: { lv: 32 },
        n: 'Wyrmling', t: ['beast', 'gale'], plan: 'draconic', b: [82, 98, 84, 92, 82, 82],
        ab: ['thickhide', 'multiscale'], ha: 'intimidate',
        dex: 'First flight is usually a controlled fall with opinions.',
        moves: [[38, 'divebomb'], [44, 'crunch']],
        evo: [
          {
            req: { lv: 52, cond: 'atk>=spa' },
            n: 'Ridgetyrant', t: ['beast', 'stone'], plan: 'draconic', b: [116, 152, 118, 84, 100, 96],
            ab: ['intimidate', 'heavyhitter'], ha: 'sturdy',
            dex: 'It owns a mountain. The mountain has been informed.',
            moves: [[58, 'tectonic'], [64, 'rampage']],
          },
          {
            req: { lv: 52, cond: 'spa>atk' },
            n: 'Stormwyrm', t: ['beast', 'volt'], plan: 'draconic', b: [110, 94, 102, 152, 108, 110],
            ab: ['cloudcaller', 'conductor'], ha: 'rainrunner',
            dex: 'Weather forms around it out of politeness.',
            moves: [[58, 'stormsurge'], [64, 'railgun']],
          },
        ],
      },
    ],
  },
});

fam('gravelump', {
  rarity: 'common',
  habitat: ['quarry', 'cave'],
  root: {
    n: 'Gravelump', t: ['stone', 'beast'], plan: 'quadruped', b: [64, 72, 70, 30, 42, 38],
    ab: ['sturdy'], ha: 'prospector',
    dex: 'Eats gravel. Produces slightly better gravel.',
    moves: [[1, 'tackle'], [10, 'rockthrow'], [18, 'gravelspray']],
    evo: [
      {
        req: { lv: 30 },
        n: 'Boulderox', t: ['stone', 'beast'], plan: 'quadruped', b: [104, 116, 108, 42, 68, 52],
        ab: ['sturdy', 'thickhide'], ha: 'prospector',
        dex: 'Quarry crews follow it around and dig wherever it stops.',
        moves: [[38, 'quake'], [46, 'stoneedge']],
      },
    ],
  },
});

fam('pebbling', {
  rarity: 'common',
  habitat: ['grass_early', 'quarry'],
  root: {
    n: 'Pebbling', t: ['stone'], plan: 'amorphous', b: [46, 50, 66, 26, 38, 44],
    ab: ['sturdy'], ha: 'forager',
    dex: 'Rolls downhill with purpose.',
    moves: [[1, 'tackle'], [7, 'harden'], [14, 'rockthrow']],
    evo: [
      {
        req: { lv: 20 },
        n: 'Cobbleknight', t: ['stone', 'metal'], plan: 'construct', b: [72, 84, 106, 40, 62, 56],
        ab: ['sturdy', 'ironwall'], ha: 'forager',
        dex: 'Assembled itself out of a collapsed wall and a strong opinion.',
        moves: [[26, 'metalclaw'], [34, 'stonewall']],
      },
    ],
  },
});

// ── Chapter / syndicate creatures ──────────────────────────────────────────
fam('frayling', {
  rarity: 'rare',
  habitat: ['rift', 'ruins'],
  root: {
    n: 'Frayling', t: ['chaos'], plan: 'amorphous', b: [52, 58, 48, 74, 52, 68],
    ab: ['weavebound'], ha: 'contrary',
    dex: 'A loose thread of the Weave that has begun to imitate a living thing.',
    moves: [[1, 'fraybolt'], [14, 'confuse'], [22, 'entropy']],
    evo: [
      {
        req: { lv: 34 },
        n: 'Snarlweave', t: ['chaos', 'umbra'], plan: 'amorphous', b: [78, 92, 72, 112, 76, 106],
        ab: ['weavebound', 'contrary'], ha: 'unravel',
        dex: 'It knots itself into whatever pattern is nearby and ruins it.',
        moves: [[40, 'unweave'], [48, 'discord']],
        evo: [
          {
            req: { lv: 54 },
            n: 'Nullhymn', t: ['chaos', 'spirit'], plan: 'floater', b: [104, 118, 92, 152, 104, 130],
            ab: ['weavebound', 'unravel'], ha: 'sovereign',
            dex: 'It sings the part of the song that was supposed to be silence.',
            moves: [[58, 'collapse'], [64, 'weavetear']],
          },
        ],
      },
    ],
  },
});

fam('cinderrat', {
  rarity: 'common',
  habitat: ['forge', 'sewer'],
  root: {
    n: 'Cinderrat', t: ['ember', 'umbra'], plan: 'quadruped', b: [44, 62, 40, 52, 42, 76],
    ab: ['cinderskin'], ha: 'stealthstep',
    dex: 'The Compact breeds them for tunnels. They are not grateful.',
    moves: [[1, 'scratch'], [9, 'ember'], [16, 'feint']],
    evo: [
      {
        req: { lv: 28 },
        n: 'Ashstalker', t: ['ember', 'umbra'], plan: 'quadruped', b: [70, 104, 62, 84, 66, 116],
        ab: ['cinderskin', 'firststrike'], ha: 'intimidate',
        dex: 'It puts out the lamps first, and then it starts.',
        moves: [[34, 'firefang'], [42, 'darkpulse']],
      },
    ],
  },
});

fam('coilhound', {
  rarity: 'uncommon',
  habitat: ['forge', 'facility'],
  root: {
    n: 'Coilhound', t: ['metal', 'volt'], plan: 'quadruped', b: [56, 70, 72, 66, 56, 72],
    ab: ['conductor'], ha: 'download',
    dex: 'Built, not born, and quietly insulted when told so.',
    moves: [[1, 'spark'], [12, 'metalclaw'], [20, 'magnetize']],
    evo: [
      {
        req: { lv: 33 },
        n: 'Dynamaw', t: ['metal', 'volt'], plan: 'quadruped', b: [84, 112, 104, 96, 82, 106],
        ab: ['conductor', 'download'], ha: 'ironwall',
        dex: 'Its jaws close a circuit. Everything after that is very quick.',
        moves: [[40, 'thunderfang'], [48, 'railgun']],
      },
    ],
  },
});

// ── Rare / pseudo-legendary ────────────────────────────────────────────────
fam('duneling', {
  rarity: 'rare',
  habitat: ['desert', 'ruins'],
  root: {
    n: 'Duneling', t: ['stone', 'toxin'], plan: 'serpent', b: [58, 68, 62, 58, 60, 66],
    ab: ['sandveil'], ha: 'drylung',
    dex: 'It is buried up to its eyes and considers this a hiding place.',
    moves: [[1, 'poisonsting'], [12, 'rockthrow'], [22, 'sandcall']],
    evo: [
      {
        req: { lv: 34 },
        n: 'Sandcoil', t: ['stone', 'toxin'], plan: 'serpent', b: [82, 96, 88, 84, 84, 92],
        ab: ['sandveil', 'duststorm'], ha: 'drylung',
        dex: 'The desert moves. Some of the moving is deliberate.',
        moves: [[40, 'venomfang'], [46, 'stoneedge']],
        evo: [
          {
            req: { lv: 54 },
            n: 'Dunesovereign', t: ['stone', 'toxin'], plan: 'serpent', b: [112, 134, 116, 124, 112, 122],
            ab: ['duststorm', 'sandveil'], ha: 'sovereign',
            dex: 'Three cities are under it. It remembers all their names.',
            moves: [[60, 'tectonic'], [66, 'toxicbloom']],
          },
        ],
      },
    ],
  },
});

fam('glimmerfin', {
  rarity: 'rare',
  habitat: ['deep', 'coast'],
  root: {
    n: 'Glimmerfin', t: ['tide', 'radiant'], plan: 'aquatic', b: [54, 50, 56, 76, 70, 72],
    ab: ['prismskin'], ha: 'raindrink',
    dex: 'Divers follow it down and forget to be frightened.',
    moves: [[1, 'splash'], [12, 'glimmer'], [22, 'mistveil']],
    evo: [
      {
        req: { lv: 36 },
        n: 'Lumenshoal', t: ['tide', 'radiant'], plan: 'aquatic', b: [86, 70, 82, 122, 106, 104],
        ab: ['prismskin', 'raindrink'], ha: 'multiscale',
        dex: 'A thousand of them together read as one enormous, patient animal.',
        moves: [[42, 'dawnbreak'], [50, 'watercannon']],
        evo: [
          {
            req: { lv: 56 },
            n: 'Abysslantern', t: ['tide', 'radiant'], plan: 'aquatic', b: [112, 92, 108, 156, 132, 118],
            ab: ['prismskin', 'dawnbringer'], ha: 'multiscale',
            dex: 'The deep is not dark. The deep is waiting for it to look at you.',
            moves: [[62, 'judgement'], [68, 'maelstrom']],
          },
        ],
      },
    ],
  },
});

// ── Legendaries ────────────────────────────────────────────────────────────
fam('helion', {
  rarity: 'legendary',
  habitat: ['summit'],
  legendary: true,
  root: {
    n: 'Helion', t: ['radiant', 'ember'], plan: 'avian', b: [126, 118, 112, 156, 128, 130],
    ab: ['dawnbringer'], ha: 'kindler',
    dex: 'The first light, still going. It has been asked to stop and declined.',
    sig: 'firstlight',
    moves: [[1, 'glimmer'], [20, 'flamethrower'], [40, 'judgement'], [55, 'sunbeckon']],
  },
});

fam('noctra', {
  rarity: 'legendary',
  habitat: ['deepdark'],
  legendary: true,
  root: {
    n: 'Noctra', t: ['umbra', 'spirit'], plan: 'draconic', b: [126, 156, 118, 128, 112, 130],
    ab: ['nightmantle'], ha: 'shadeeater',
    dex: 'Patient as the dark is patient. It is not the enemy of the light; it is the rest of the day.',
    sig: 'longnight',
    moves: [[1, 'nightsting'], [20, 'darkpulse'], [40, 'voidfang'], [55, 'shadowveil']],
  },
});

fam('sylvara', {
  rarity: 'legendary',
  habitat: ['heartwood'],
  legendary: true,
  root: {
    n: 'Sylvara', t: ['verdant', 'mind'], plan: 'plant', b: [146, 108, 138, 148, 148, 82],
    ab: ['worldroot'], ha: 'photosynth',
    dex: 'The root that holds the Weave to the ground. It is very tired and will not say so.',
    sig: 'worldsong',
    moves: [[1, 'absorb'], [20, 'megadrain'], [40, 'bloomburst'], [55, 'blessing']],
  },
});

fam('unmaker', {
  rarity: 'legendary',
  habitat: ['rift'],
  legendary: true,
  root: {
    n: 'Vaelthrum', t: ['chaos'], plan: 'amorphous', b: [136, 148, 126, 168, 126, 136],
    ab: ['sovereign'], ha: 'weavebound',
    dex: 'It is what the Weave becomes when nobody is holding the other end.',
    sig: 'finalthread',
    moves: [[1, 'fraybolt'], [20, 'unweave'], [40, 'collapse'], [55, 'weavetear']],
  },
});

fam('mirrorkin', {
  rarity: 'mythic',
  habitat: ['nowhere'],
  legendary: true,
  root: {
    n: 'Echoself', t: ['mind', 'chaos'], plan: 'floater', b: [110, 110, 110, 110, 110, 110],
    ab: ['download'], ha: 'contrary',
    dex: 'It arrives wearing the shape of whatever you brought with you.',
    moves: [[1, 'psywave'], [15, 'confuse'], [30, 'unweave'], [45, 'mindbreak'], [55, 'rewrite']],
  },
});

export { FAMILIES };
