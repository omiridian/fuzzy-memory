// Quests. Steps complete when their flag is set; a quest completes when all
// of its steps are done. The quest log reacts to flags rather than being
// driven directly, so any script, battle or item pickup can advance a quest.

export const QUESTS = {};

function quest(id, def) {
  QUESTS[id] = { id, type: 'side', ...def };
  return QUESTS[id];
}

// ── Main story: The Unweaving ──────────────────────────────────────────────
quest('ch1_first_light', {
  type: 'main',
  chapter: 1,
  name: 'First Light',
  giver: 'Professor Aldrin',
  summary:
    'Professor Aldrin has a Weave Ledger with your name on it, and a case with three creatures in it.',
  steps: [
    { id: 'meet', text: 'Speak with Professor Aldrin in her laboratory.', flag: 'met_aldrin' },
    { id: 'choose', text: 'Choose a partner from the case.', flag: 'chose_starter' },
    { id: 'road', text: 'Take Meadow Road north toward Emberwood.', flag: 'entered_route1' },
  ],
  reward: { money: 0, items: [{ item: 'orb', qty: 5 }] },
  nextQuest: 'ch2_grove',
});

quest('ch2_grove', {
  type: 'main',
  chapter: 2,
  name: 'What the Grove Lost',
  giver: 'Ranger Sabbe',
  summary:
    'Something has been cutting through Emberwood and leaving the ground grey behind it. Warden Ilse holds trials at the Grove Hall.',
  steps: [
    { id: 'ranger', text: 'Hear out Ranger Sabbe in Emberwood.', flag: 'talked_sabbe' },
    { id: 'trial', text: "Pass Warden Ilse's trial at the Grove Hall.", flag: 'seal_verdant' },
  ],
  reward: { money: 1200, items: [{ item: 'tome_megadrain', qty: 1 }] },
  nextQuest: 'ch3_harbour',
});

quest('ch3_harbour', {
  type: 'main',
  chapter: 3,
  name: 'What Docks at Night',
  giver: 'Warden Maris',
  summary:
    'Freighters put in at Tidefall harbour after dark and nobody signs for them. Warden Maris wants to know why — after you have earned her seal.',
  steps: [
    { id: 'trial', text: "Pass Warden Maris's trial at the Tide Hall.", flag: 'seal_tide' },
    { id: 'warehouse', text: 'Get into the Compact warehouse on the harbour.', flag: 'entered_warehouse' },
    { id: 'plans', text: 'Take the siphon schematics.', flag: 'got_schematics' },
  ],
  reward: { money: 2000, items: [{ item: 'ultraorb', qty: 5 }] },
  nextQuest: 'ch4_ridge',
});

quest('ch4_ridge', {
  type: 'main',
  chapter: 4,
  name: 'The Ridge Says No',
  giver: 'Warden Kessa',
  summary:
    'The Compact tried to buy Stormridge outright. Kessa laughed. Now they are doing it the other way, and the quarry road is the way through.',
  steps: [
    { id: 'quarry', text: 'Cross Copper Quarry to Stormridge.', flag: 'entered_stormridge' },
    { id: 'trial', text: "Pass Warden Kessa's trial at the Storm Hall.", flag: 'seal_volt' },
  ],
  reward: { money: 2600, items: [{ item: 'tome_voltbeam', qty: 1 }] },
  nextQuest: 'ch5_ashfall',
});

quest('ch5_ashfall', {
  type: 'main',
  chapter: 5,
  name: 'The Vent Works',
  giver: 'Warden Bruhn',
  summary:
    'The Compact bought the Ashfall vent works without buying anything. Warden Bruhn has been down there twice and come back quiet.',
  steps: [
    { id: 'fen', text: 'Cross the Fen of Sighs to Ashfall.', flag: 'entered_ashfall' },
    { id: 'trial', text: "Pass Warden Bruhn's trial at the Ember Hall.", flag: 'seal_ember' },
  ],
  reward: { money: 3200, items: [{ item: 'fullrestore', qty: 3 }] },
  nextQuest: 'ch6_archive',
});

quest('ch6_archive', {
  type: 'main',
  chapter: 6,
  name: 'Read the Last Page',
  giver: 'Archivist Nedd',
  summary:
    'The Sunken Archive holds what the first Wardens wrote about the Weave. The Compact got there first and read further than anyone should.',
  steps: [
    { id: 'enter', text: 'Reach the Sunken Archive beyond Ashfall.', flag: 'entered_sunken_archive' },
    { id: 'scholar', text: 'Hear what Archivist Nedd has pieced together.', flag: 'talked_nedd' },
    { id: 'adept', text: 'Stop Compact Adept Yreni in the Archive.', flag: 'archive_cleared' },
  ],
  reward: { money: 4000, items: [{ item: 'riftglass', qty: 1 }] },
  nextQuest: 'ch7_riftmouth',
});

quest('ch7_riftmouth', {
  type: 'main',
  chapter: 7,
  name: 'The Unweaving',
  giver: 'The Wardens',
  summary:
    'Hollis Cray has cut the Weave open at the Riftmouth. Four seals will get you through the door. What is on the other side is not a person any more.',
  steps: [
    { id: 'seals', text: 'Hold all four Warden Seals.', flag: 'all_seals' },
    { id: 'rift', text: 'Enter the Riftmouth.', flag: 'entered_riftmouth' },
    { id: 'hollis', text: 'Face Hollis Cray.', flag: 'defeated_hollis' },
    { id: 'close', text: 'Close the tear.', flag: 'rift_closed' },
  ],
  reward: { money: 10000, items: [{ item: 'masterorb', qty: 1 }] },
  nextQuest: 'ch8_after',
});

quest('ch8_after', {
  type: 'main',
  chapter: 8,
  name: 'What Grows Back',
  giver: 'Professor Aldrin',
  summary:
    'The tear is closed. The Weave is thin in places and something very old has woken up in the Heartwood. Aldrin would like a full Ledger, if you have the time.',
  steps: [
    { id: 'heartwood', text: 'Find the way into the Heartwood.', flag: 'entered_heartwood' },
    { id: 'sylvara', text: 'Meet what is waiting there.', flag: 'met_sylvara' },
  ],
  reward: { money: 12000, items: [{ item: 'luckyegg', qty: 1 }] },
});

// ── Side quests ────────────────────────────────────────────────────────────
quest('side_mother_salves', {
  name: 'Packed for the Road',
  giver: 'Your mother',
  summary: 'She packed salves. Take them before she brings it up again.',
  steps: [{ id: 'take', text: 'Accept the salves from your mother.', flag: 'hv_mother_gift' }],
  reward: { money: 0 },
  autoStart: true,
});

quest('side_first_catch', {
  name: 'One of Your Own',
  giver: 'Professor Aldrin',
  summary: 'Aldrin wants proof the Ledger works: catch a creature in the wild.',
  steps: [{ id: 'catch', text: 'Catch any wild creature.', flag: 'first_catch' }],
  reward: { money: 500, items: [{ item: 'greatorb', qty: 5 }] },
  autoStart: true,
});

quest('side_herbalist', {
  name: 'Ten Bitter Herbs',
  giver: 'The Woodcutter',
  summary: 'The woodcutter in Emberwood trades move tomes for bitter herbs. Ten a time.',
  steps: [{ id: 'trade', text: 'Trade ten bitter herbs to the woodcutter.', flag: 'herb_trade' }],
  reward: { money: 0 },
  repeatable: true,
  autoStart: true,
});

quest('side_rod', {
  name: 'Nothing Biting',
  giver: 'Angler Rho',
  summary: 'Angler Rho on the Coast Road will hand over a rod to anyone who can out-fish him in a fight.',
  steps: [{ id: 'beat', text: 'Defeat Angler Rho.', flag: 'beat_rho' }],
  reward: { money: 600 },
  autoStart: true,
});

quest('side_pick', {
  name: 'Cracked Rock',
  giver: 'Digger Halt',
  summary: 'Halt keeps a spare quarry pick for anyone who can take a hit underground.',
  steps: [{ id: 'beat', text: 'Defeat Digger Halt in Copper Quarry.', flag: 'beat_halt' }],
  reward: { money: 1200 },
  autoStart: true,
});

quest('side_candle', {
  name: 'A Candle for the Fen',
  giver: 'Fenwife Alder',
  summary: 'The Fenwife keeps a grave candle burning. She will part with one, for a price paid in battle.',
  steps: [{ id: 'beat', text: 'Defeat Fenwife Alder.', flag: 'beat_alder' }],
  reward: { money: 1800 },
  autoStart: true,
});

quest('side_smith', {
  name: 'Scrap and Purpose',
  giver: 'The Ashfall Smith',
  summary: 'The smith turns scrap metal into held gear. Five pieces a time.',
  steps: [{ id: 'trade', text: 'Bring the smith five pieces of scrap metal.', flag: 'smith_trade' }],
  reward: {},
  repeatable: true,
  autoStart: true,
});

quest('side_dex_50', {
  name: 'A Ledger Worth Reading',
  giver: 'Professor Aldrin',
  summary: 'Aldrin wants fifty species recorded in the Ledger.',
  steps: [{ id: 'fifty', text: 'Record 50 species in the Weave Ledger.', flag: 'dex_50' }],
  reward: { money: 5000, items: [{ item: 'amulet', qty: 1 }] },
  autoStart: true,
});

quest('side_dex_150', {
  name: 'Most of a World',
  giver: 'Professor Aldrin',
  summary: 'One hundred and fifty species. Aldrin did not think it could be done in a season.',
  steps: [{ id: 'onefifty', text: 'Record 150 species in the Weave Ledger.', flag: 'dex_150' }],
  reward: { money: 20000, items: [{ item: 'hiddencapsule', qty: 3 }] },
  autoStart: true,
});

quest('side_evolve_five', {
  name: 'Everything Changes',
  giver: 'The Emberwood Hermit',
  summary: 'The hermit wants to see five creatures change shape under your care.',
  steps: [{ id: 'five', text: 'Evolve five creatures.', flag: 'evolved_5' }],
  reward: { money: 3000, items: [{ item: 'dawn_stone', qty: 1 }, { item: 'dusk_stone', qty: 1 }] },
  autoStart: true,
});

quest('side_compact_hands', {
  name: 'Hands of the Compact',
  giver: 'Warden Maris',
  summary: 'The Compact keeps field agents on every road. Maris wants them discouraged.',
  steps: [
    { id: 'coast', text: 'Turn back the Compact Hand on the Coast Road.', flag: 'compact_coast' },
    { id: 'fen', text: 'Turn back the Compact Hand in the Fen.', flag: 'compact_fen' },
    { id: 'warehouse', text: 'Clear the harbour warehouse.', flag: 'entered_warehouse' },
  ],
  reward: { money: 6000, items: [{ item: 'nugget', qty: 2 }] },
  autoStart: true,
});

quest('side_legend_helion', {
  name: 'The First Light',
  giver: 'Rumour',
  summary: 'They say something has been circling the summit since the tear opened.',
  steps: [{ id: 'meet', text: 'Find what circles the summit.', flag: 'met_helion' }],
  reward: { money: 0 },
  hidden: true,
});

quest('side_legend_noctra', {
  name: 'The Long Night',
  giver: 'Rumour',
  summary: 'Below the Archive the dark goes down further than the Archive does.',
  steps: [{ id: 'meet', text: 'Find what waits below the Archive.', flag: 'met_noctra' }],
  reward: { money: 0 },
  hidden: true,
});

quest('side_champion', {
  name: 'The Long Way Round',
  giver: 'The Wardens',
  summary: 'Beat every Warden, then beat them again when they come at you properly.',
  steps: [
    { id: 'verdant', text: 'Warden Ilse — Verdant.', flag: 'seal_verdant' },
    { id: 'tide', text: 'Warden Maris — Tide.', flag: 'seal_tide' },
    { id: 'volt', text: 'Warden Kessa — Volt.', flag: 'seal_volt' },
    { id: 'ember', text: 'Warden Bruhn — Ember.', flag: 'seal_ember' },
  ],
  reward: { money: 8000, items: [{ item: 'masterorb', qty: 0 }] },
  autoStart: true,
});

export const QUEST_IDS = Object.keys(QUESTS);

export function getQuest(id) {
  return QUESTS[id] || null;
}

export function mainQuests() {
  return QUEST_IDS.map((id) => QUESTS[id])
    .filter((q) => q.type === 'main')
    .sort((a, b) => a.chapter - b.chapter);
}
