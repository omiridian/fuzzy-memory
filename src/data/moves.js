// The move list. Every entry is plain data; src/battle/effects.js decides what
// the fields actually do so the data stays readable.
//
//   category  'physical' | 'special' | 'status'
//   power     base power (0 for status moves)
//   accuracy  0-100, or 0 for "never misses"
//   priority  higher moves first; ties broken by Speed
//   contact   the user physically touches the target
//   effect    optional effect descriptor, see effects.js

const M = {};

function move(id, name, type, category, power, accuracy, pp, opts = {}) {
  M[id] = {
    id,
    name,
    type,
    category,
    power,
    accuracy,
    pp,
    priority: opts.priority || 0,
    contact: opts.contact !== undefined ? opts.contact : category === 'physical',
    target: opts.target || (category === 'status' ? 'self' : 'foe'),
    effect: opts.effect || null,
    desc: opts.desc || '',
    sound: opts.sound || false,
    punch: opts.punch || false,
    bite: opts.bite || false,
    signature: opts.signature || false,
  };
  return M[id];
}

// ── Universal starter moves ────────────────────────────────────────────────
move('tackle', 'Tackle', 'beast', 'physical', 40, 100, 35, { desc: 'A plain full-body charge.' });
move('scratch', 'Scratch', 'beast', 'physical', 40, 100, 35, { desc: 'Rakes the foe with claws.' });
move('nip', 'Nip', 'beast', 'physical', 45, 100, 30, { bite: true, desc: 'A quick warning bite.' });
move('headbutt', 'Headbutt', 'beast', 'physical', 70, 100, 15, {
  effect: { flinch: 30 },
  desc: 'A blunt charge that may make the foe flinch.',
});
move('bodyslam', 'Body Slam', 'beast', 'physical', 85, 100, 15, {
  effect: { status: 'paralysis', chance: 30 },
  desc: 'Drops full weight on the foe. May paralyse.',
});
move('slam', 'Slam', 'beast', 'physical', 80, 85, 20, { desc: 'A heavy swinging blow.' });
move('thrash', 'Thrash', 'beast', 'physical', 120, 95, 10, {
  effect: { selfBoost: { def: -1, spd: -1 } },
  desc: 'A reckless flurry that leaves the user open.',
});
move('quickstrike', 'Quick Strike', 'beast', 'physical', 40, 100, 30, {
  priority: 1,
  desc: 'Always lands first.',
});
move('lastditch', 'Last Ditch', 'beast', 'physical', 130, 100, 5, {
  effect: { recoil: 0.33 },
  desc: 'An all-or-nothing tackle that hurts the user badly.',
});
move('rest', 'Rest', 'mind', 'status', 0, 0, 10, {
  effect: { rest: true },
  desc: 'Sleeps for two turns and wakes at full health.',
});
move('recover', 'Recover', 'mind', 'status', 0, 0, 10, {
  effect: { heal: 0.5 },
  desc: 'Restores half of maximum HP.',
});
move('protect', 'Protect', 'mind', 'status', 0, 0, 10, {
  priority: 4,
  effect: { protect: true },
  desc: 'Blocks the incoming attack. Fails if used repeatedly.',
});
move('growl', 'Growl', 'beast', 'status', 0, 100, 40, {
  target: 'foe',
  sound: true,
  effect: { boost: { atk: -1 }, target: 'foe' },
  desc: 'Lowers the foe’s Attack.',
});
move('leer', 'Leer', 'beast', 'status', 0, 100, 30, {
  target: 'foe',
  effect: { boost: { def: -1 }, target: 'foe' },
  desc: 'Lowers the foe’s Defense.',
});
move('screech', 'Screech', 'beast', 'status', 0, 85, 20, {
  target: 'foe',
  sound: true,
  effect: { boost: { def: -2 }, target: 'foe' },
  desc: 'Sharply lowers the foe’s Defense.',
});
move('harden', 'Harden', 'metal', 'status', 0, 0, 30, {
  effect: { boost: { def: 1 } },
  desc: 'Tenses up to raise Defense.',
});
move('focus', 'Focus', 'mind', 'status', 0, 0, 20, {
  effect: { boost: { atk: 1, spa: 1 } },
  desc: 'Centres itself, raising both attacking stats.',
});
move('agility', 'Agility', 'gale', 'status', 0, 0, 30, {
  effect: { boost: { spe: 2 } },
  desc: 'Sharply raises Speed.',
});
move('bulkup', 'Bulk Up', 'beast', 'status', 0, 0, 20, {
  effect: { boost: { atk: 1, def: 1 } },
  desc: 'Raises Attack and Defense.',
});
move('calmmind', 'Calm Mind', 'mind', 'status', 0, 0, 20, {
  effect: { boost: { spa: 1, spd: 1 } },
  desc: 'Raises Sp. Atk and Sp. Def.',
});
move('dancewind', 'Wind Dance', 'gale', 'status', 0, 0, 20, {
  effect: { boost: { atk: 2 } },
  desc: 'A whirling dance that sharply raises Attack.',
});
move('sandsong', 'Sand Song', 'stone', 'status', 0, 0, 20, {
  effect: { boost: { def: 1, spd: 1 } },
  desc: 'A low hum that hardens the body.',
});

// ── Ember ──────────────────────────────────────────────────────────────────
move('ember', 'Ember', 'ember', 'special', 40, 100, 25, {
  effect: { status: 'burn', chance: 10 },
  desc: 'A small dart of flame. May burn.',
});
move('flamelash', 'Flame Lash', 'ember', 'special', 65, 100, 20, {
  effect: { status: 'burn', chance: 20 },
  desc: 'A whip of fire. May burn.',
});
move('firefang', 'Fire Fang', 'ember', 'physical', 70, 95, 15, {
  bite: true,
  effect: { status: 'burn', chance: 15, flinch: 10 },
  desc: 'Bites with burning jaws.',
});
move('flamethrower', 'Flamethrower', 'ember', 'special', 90, 100, 15, {
  effect: { status: 'burn', chance: 15 },
  desc: 'A sustained jet of fire.',
});
move('cinderstorm', 'Cinder Storm', 'ember', 'special', 110, 85, 10, {
  effect: { status: 'burn', chance: 30 },
  desc: 'A whirling column of embers.',
});
move('pyreblast', 'Pyre Blast', 'ember', 'special', 130, 80, 5, {
  effect: { status: 'burn', chance: 20 },
  desc: 'A furnace-hot detonation.',
});
move('flarepunch', 'Flare Punch', 'ember', 'physical', 100, 95, 10, {
  punch: true,
  effect: { recoil: 0.2, status: 'burn', chance: 10 },
  desc: 'A blazing fist that scorches the user too.',
});
move('emberdance', 'Ember Dance', 'ember', 'status', 0, 0, 20, {
  effect: { boost: { spa: 2 } },
  desc: 'A shimmering dance that sharply raises Sp. Atk.',
});
move('sunbeckon', 'Sun Beckon', 'ember', 'status', 0, 0, 5, {
  effect: { weather: 'sun' },
  desc: 'Calls harsh sunlight for five turns.',
});
move('ashcloak', 'Ash Cloak', 'ember', 'status', 0, 0, 15, {
  effect: { boost: { def: 1, spa: 1 } },
  desc: 'Wraps itself in hot ash.',
});
move('magmadrill', 'Magma Drill', 'ember', 'physical', 85, 95, 10, {
  effect: { boost: { spe: 1 }, chance: 20 },
  desc: 'Spins through the foe on a jet of magma.',
});
move('solarlance', 'Solar Lance', 'ember', 'special', 120, 100, 10, {
  effect: { chargeUnless: 'sun' },
  desc: 'Charges a turn first — unless the sun is already high.',
});

// ── Tide ───────────────────────────────────────────────────────────────────
move('splash', 'Splash', 'tide', 'special', 40, 100, 25, { desc: 'A spray of water.' });
move('bubblebeam', 'Bubble Beam', 'tide', 'special', 65, 100, 20, {
  effect: { boost: { spe: -1 }, target: 'foe', chance: 30 },
  desc: 'A stream of bubbles that may slow the foe.',
});
move('aquafang', 'Aqua Fang', 'tide', 'physical', 70, 95, 15, {
  bite: true,
  effect: { flinch: 20 },
  desc: 'Bites down with water-slick jaws.',
});
move('watercannon', 'Water Cannon', 'tide', 'special', 90, 100, 15, { desc: 'A pressurised blast.' });
move('tidalcrash', 'Tidal Crash', 'tide', 'special', 110, 85, 10, {
  effect: { boost: { spa: -1 }, target: 'self', chance: 100 },
  desc: 'A wall of water. Tiring to summon.',
});
move('maelstrom', 'Maelstrom', 'tide', 'special', 130, 80, 5, {
  effect: { status: 'confusion', chance: 20 },
  desc: 'A spiralling vortex that leaves the foe reeling.',
});
move('aquathrust', 'Aqua Thrust', 'tide', 'physical', 40, 100, 30, {
  priority: 1,
  desc: 'Rides a wave in first.',
});
move('undertow', 'Undertow', 'tide', 'physical', 80, 100, 10, {
  effect: { drain: 0.5 },
  desc: 'Drags the foe under and takes their strength.',
});
move('raincall', 'Rain Call', 'tide', 'status', 0, 0, 5, {
  effect: { weather: 'rain' },
  desc: 'Calls rain for five turns.',
});
move('mistveil', 'Mist Veil', 'tide', 'status', 0, 0, 20, {
  effect: { boost: { spd: 2 } },
  desc: 'Hides in cold mist, sharply raising Sp. Def.',
});
move('brine', 'Brine', 'tide', 'special', 65, 100, 10, {
  effect: { doubleIfHurt: true },
  desc: 'Doubles in power against a wounded foe.',
});
move('whirlpool', 'Whirlpool', 'tide', 'special', 45, 90, 15, {
  effect: { trap: 4 },
  desc: 'Traps the foe in a spinning current.',
});

// ── Verdant ────────────────────────────────────────────────────────────────
move('vinewhip', 'Vine Whip', 'verdant', 'physical', 45, 100, 25, { desc: 'A quick lash of vine.' });
move('razorleaf', 'Razor Leaf', 'verdant', 'physical', 60, 95, 25, {
  contact: false,
  effect: { critStage: 1 },
  desc: 'Sharp leaves that often land critically.',
});
move('leechseed', 'Leech Seed', 'verdant', 'status', 0, 90, 10, {
  target: 'foe',
  effect: { seed: true },
  desc: 'Plants a seed that drains the foe each turn.',
});
move('absorb', 'Absorb', 'verdant', 'special', 40, 100, 25, {
  effect: { drain: 0.5 },
  desc: 'Drains a little health.',
});
move('megadrain', 'Mega Drain', 'verdant', 'special', 75, 100, 15, {
  effect: { drain: 0.5 },
  desc: 'Drains a good deal of health.',
});
move('canopyslam', 'Canopy Slam', 'verdant', 'physical', 90, 95, 15, { desc: 'A crushing bough.' });
move('bloomburst', 'Bloom Burst', 'verdant', 'special', 110, 90, 10, {
  effect: { boost: { spa: -1 }, target: 'self', chance: 100 },
  desc: 'Bursts into flower with enormous force.',
});
move('thornfield', 'Thornfield', 'verdant', 'status', 0, 0, 20, {
  effect: { hazard: 'thorns' },
  desc: 'Scatters thorns that hurt whatever the foe sends out.',
});
move('growth', 'Growth', 'verdant', 'status', 0, 0, 20, {
  effect: { boost: { atk: 1, spa: 1 }, sunDouble: true },
  desc: 'Grows — doubly so in sunlight.',
});
move('sporecloud', 'Spore Cloud', 'verdant', 'status', 0, 75, 10, {
  target: 'foe',
  effect: { status: 'sleep', chance: 100 },
  desc: 'Puts the foe to sleep.',
});
move('rootbind', 'Root Bind', 'verdant', 'status', 0, 95, 20, {
  target: 'foe',
  effect: { boost: { spe: -2 }, target: 'foe' },
  desc: 'Roots the foe in place, sharply cutting Speed.',
});
move('worldsplit', 'Worldsplit', 'verdant', 'physical', 120, 85, 5, {
  effect: { critStage: 1 },
  desc: 'Splits the ground open with rooted force.',
});

// ── Volt ───────────────────────────────────────────────────────────────────
move('spark', 'Spark', 'volt', 'physical', 45, 100, 25, {
  effect: { status: 'paralysis', chance: 20 },
  desc: 'A jolt on contact. May paralyse.',
});
move('shockwave', 'Shock Wave', 'volt', 'special', 60, 0, 20, { desc: 'A current that never misses.' });
move('thunderfang', 'Thunder Fang', 'volt', 'physical', 70, 95, 15, {
  bite: true,
  effect: { status: 'paralysis', chance: 15, flinch: 10 },
  desc: 'Bites with crackling jaws.',
});
move('voltbeam', 'Volt Beam', 'volt', 'special', 90, 100, 15, {
  effect: { status: 'paralysis', chance: 15 },
  desc: 'A focused bolt.',
});
move('stormsurge', 'Storm Surge', 'volt', 'special', 110, 85, 10, {
  effect: { status: 'paralysis', chance: 30, rainPerfect: true },
  desc: 'Never misses in rain.',
});
move('thunderclap', 'Thunderclap', 'volt', 'special', 40, 100, 30, {
  priority: 1,
  desc: 'A crack of lightning that comes first.',
});
move('overcharge', 'Overcharge', 'volt', 'physical', 120, 100, 5, {
  effect: { recoil: 0.33 },
  desc: 'Dumps everything at once. Badly hurts the user.',
});
move('paralyzecoil', 'Paralyse Coil', 'volt', 'status', 0, 90, 20, {
  target: 'foe',
  effect: { status: 'paralysis', chance: 100 },
  desc: 'Wraps the foe in current.',
});
move('chargeup', 'Charge Up', 'volt', 'status', 0, 0, 20, {
  effect: { boost: { spa: 1, spd: 1 } },
  desc: 'Stores charge, raising Sp. Atk and Sp. Def.',
});
move('magnetize', 'Magnetise', 'volt', 'status', 0, 100, 15, {
  target: 'foe',
  effect: { boost: { spe: -1 }, target: 'foe', trap: 4 },
  desc: 'Pins the foe with a magnetic field.',
});
move('railgun', 'Railgun', 'volt', 'special', 130, 75, 5, {
  effect: { critStage: 1 },
  desc: 'Fires a slug of charged metal.',
});

// ── Frost ──────────────────────────────────────────────────────────────────
move('chill', 'Chill', 'frost', 'special', 40, 100, 25, {
  effect: { boost: { spe: -1 }, target: 'foe', chance: 20 },
  desc: 'A breath of cold air.',
});
move('icefang', 'Ice Fang', 'frost', 'physical', 70, 95, 15, {
  bite: true,
  effect: { status: 'freeze', chance: 10, flinch: 10 },
  desc: 'Bites with frozen jaws.',
});
move('frostbeam', 'Frost Beam', 'frost', 'special', 90, 100, 15, {
  effect: { status: 'freeze', chance: 10 },
  desc: 'A beam of absolute cold.',
});
move('glacierfall', 'Glacier Fall', 'frost', 'physical', 110, 85, 10, {
  contact: false,
  desc: 'Drops a shelf of ice on the foe.',
});
move('permafrost', 'Permafrost', 'frost', 'special', 130, 75, 5, {
  effect: { status: 'freeze', chance: 25 },
  desc: 'A killing winter in one breath.',
});
move('iceshard', 'Ice Shard', 'frost', 'physical', 40, 100, 30, {
  priority: 1,
  contact: false,
  desc: 'A flicked splinter of ice.',
});
move('hailcall', 'Hail Call', 'frost', 'status', 0, 0, 5, {
  effect: { weather: 'hail' },
  desc: 'Calls hail for five turns.',
});
move('frostarmor', 'Frost Armor', 'frost', 'status', 0, 0, 20, {
  effect: { boost: { def: 2 } },
  desc: 'Sheathes itself in ice, sharply raising Defense.',
});
move('rimewalk', 'Rimewalk', 'frost', 'physical', 80, 100, 10, {
  effect: { boost: { spe: 1 }, chance: 30 },
  desc: 'Skates across frost, sometimes picking up speed.',
});

// ── Gale ───────────────────────────────────────────────────────────────────
move('gust', 'Gust', 'gale', 'special', 40, 100, 30, { desc: 'A buffet of wind.' });
move('wingbeat', 'Wingbeat', 'gale', 'physical', 60, 100, 25, { desc: 'Strikes with hard wings.' });
move('aircutter', 'Air Cutter', 'gale', 'special', 65, 95, 20, {
  effect: { critStage: 1 },
  desc: 'Blades of wind that cut deep.',
});
move('divebomb', 'Dive Bomb', 'gale', 'physical', 90, 95, 15, {
  effect: { flinch: 20 },
  desc: 'A plunging strike from above.',
});
move('cyclone', 'Cyclone', 'gale', 'special', 110, 85, 10, {
  effect: { status: 'confusion', chance: 20 },
  desc: 'A spinning wall of air.',
});
move('skysplitter', 'Skysplitter', 'gale', 'physical', 130, 80, 5, {
  effect: { recoil: 0.25 },
  desc: 'A dive so fast the air burns.',
});
move('tailwind', 'Tailwind', 'gale', 'status', 0, 0, 15, {
  effect: { boost: { spe: 2 } },
  desc: 'Rides a following wind.',
});
move('roost', 'Roost', 'gale', 'status', 0, 0, 10, {
  effect: { heal: 0.5 },
  desc: 'Lands and rests, restoring half its HP.',
});
move('whirlwind', 'Whirlwind', 'gale', 'status', 0, 100, 20, {
  target: 'foe',
  priority: -6,
  effect: { forceSwitch: true },
  desc: 'Blows the foe away, ending a wild battle.',
});

// ── Stone ──────────────────────────────────────────────────────────────────
move('rockthrow', 'Rock Throw', 'stone', 'physical', 50, 90, 15, {
  contact: false,
  desc: 'Hurls a stone.',
});
move('stoneedge', 'Stone Edge', 'stone', 'physical', 100, 80, 5, {
  contact: false,
  effect: { critStage: 1 },
  desc: 'Jagged pillars erupt beneath the foe.',
});
move('boulderdrop', 'Boulder Drop', 'stone', 'physical', 90, 90, 10, {
  contact: false,
  effect: { flinch: 20 },
  desc: 'Drops a boulder from a height.',
});
move('quake', 'Quake', 'stone', 'physical', 100, 100, 10, {
  contact: false,
  desc: 'Shakes the whole battlefield.',
});
move('gravelspray', 'Gravel Spray', 'stone', 'physical', 25, 90, 20, {
  contact: false,
  effect: { multiHit: [2, 5] },
  desc: 'Sprays grit two to five times.',
});
move('stonewall', 'Stone Wall', 'stone', 'status', 0, 0, 20, {
  effect: { boost: { def: 2 } },
  desc: 'Raises a wall of rock.',
});
move('sandcall', 'Sand Call', 'stone', 'status', 0, 0, 5, {
  effect: { weather: 'sand' },
  desc: 'Whips up a sandstorm for five turns.',
});
move('shardfield', 'Shardfield', 'stone', 'status', 0, 0, 20, {
  effect: { hazard: 'shards' },
  desc: 'Scatters sharp stone across the foe’s side.',
});
move('tectonic', 'Tectonic', 'stone', 'physical', 130, 80, 5, {
  contact: false,
  effect: { selfBoost: { spe: -1 } },
  desc: 'Splits the bedrock. Slow to recover from.',
});

// ── Metal ──────────────────────────────────────────────────────────────────
move('metalclaw', 'Metal Claw', 'metal', 'physical', 50, 95, 35, {
  effect: { selfBoost: { atk: 1 }, chance: 30 },
  desc: 'Rakes with alloy claws. May sharpen them.',
});
move('ironhead', 'Iron Head', 'metal', 'physical', 80, 100, 15, {
  effect: { flinch: 30 },
  desc: 'A skull-first charge that often staggers.',
});
move('gearpunch', 'Gear Punch', 'metal', 'physical', 100, 90, 10, {
  punch: true,
  desc: 'A piston-driven fist.',
});
move('flashcannon', 'Flash Cannon', 'metal', 'special', 90, 100, 10, {
  effect: { boost: { spd: -1 }, target: 'foe', chance: 20 },
  desc: 'A beam of hard light and steel.',
});
move('bladestorm', 'Bladestorm', 'metal', 'physical', 120, 85, 5, {
  effect: { critStage: 1 },
  desc: 'A whirl of edges.',
});
move('platingup', 'Plating Up', 'metal', 'status', 0, 0, 20, {
  effect: { boost: { def: 1, spd: 1 } },
  desc: 'Layers on fresh plating.',
});
move('caltrops', 'Caltrops', 'metal', 'status', 0, 0, 20, {
  effect: { hazard: 'caltrops' },
  desc: 'Scatters metal spikes on the foe’s side.',
});
move('magnetstrike', 'Magnet Strike', 'metal', 'physical', 70, 0, 15, {
  desc: 'A guided blow that never misses.',
});

// ── Toxin ──────────────────────────────────────────────────────────────────
move('poisonsting', 'Poison Sting', 'toxin', 'physical', 35, 100, 35, {
  effect: { status: 'poison', chance: 30 },
  desc: 'A barbed jab. May poison.',
});
move('acidspray', 'Acid Spray', 'toxin', 'special', 55, 100, 20, {
  effect: { boost: { spd: -2 }, target: 'foe', chance: 100 },
  desc: 'Melts the foe’s guard.',
});
move('venomfang', 'Venom Fang', 'toxin', 'physical', 75, 95, 15, {
  bite: true,
  effect: { status: 'poison', chance: 40 },
  desc: 'Sinks venomous teeth in.',
});
move('sludgewave', 'Sludge Wave', 'toxin', 'special', 95, 100, 10, {
  effect: { status: 'poison', chance: 20 },
  desc: 'A wave of filth.',
});
move('toxicbloom', 'Toxic Bloom', 'toxin', 'special', 120, 85, 5, {
  effect: { status: 'poison', chance: 30 },
  desc: 'Bursts open into a cloud of spores.',
});
move('toxify', 'Toxify', 'toxin', 'status', 0, 90, 10, {
  target: 'foe',
  effect: { status: 'toxic', chance: 100 },
  desc: 'Badly poisons the foe — the damage worsens each turn.',
});
move('miasma', 'Miasma', 'toxin', 'status', 0, 0, 20, {
  effect: { hazard: 'miasma' },
  desc: 'Fills the foe’s side with poison fog.',
});
move('purge', 'Purge', 'toxin', 'status', 0, 0, 10, {
  effect: { cureStatus: true, heal: 0.25 },
  desc: 'Sweats out toxins, healing status and some HP.',
});

// ── Beast ──────────────────────────────────────────────────────────────────
move('bite', 'Bite', 'beast', 'physical', 60, 100, 25, {
  bite: true,
  effect: { flinch: 30 },
  desc: 'A hard bite that may make the foe flinch.',
});
move('crunch', 'Crunch', 'beast', 'physical', 80, 100, 15, {
  bite: true,
  effect: { boost: { def: -1 }, target: 'foe', chance: 20 },
  desc: 'Crushes through the foe’s guard.',
});
move('maul', 'Maul', 'beast', 'physical', 100, 90, 10, { desc: 'A savage two-clawed strike.' });
move('rampage', 'Rampage', 'beast', 'physical', 130, 85, 5, {
  effect: { recoil: 0.25 },
  desc: 'A blind charge that costs the user.',
});
move('howl', 'Howl', 'beast', 'status', 0, 0, 20, {
  sound: true,
  effect: { boost: { atk: 2 } },
  desc: 'A rousing howl that sharply raises Attack.',
});
move('roar', 'Roar', 'beast', 'status', 0, 100, 20, {
  target: 'foe',
  sound: true,
  effect: { boost: { atk: -1, spa: -1 }, target: 'foe' },
  desc: 'A roar that cows the foe.',
});
move('packhunt', 'Pack Hunt', 'beast', 'physical', 25, 95, 20, {
  effect: { multiHit: [2, 5] },
  desc: 'The pack strikes two to five times.',
});
move('runaway', 'Run Away', 'beast', 'status', 0, 0, 10, {
  effect: { fleeField: true },
  desc: 'Bolts from a wild battle without fail.',
});

// ── Insect ─────────────────────────────────────────────────────────────────
move('stingshot', 'Sting Shot', 'insect', 'physical', 40, 100, 30, { desc: 'A quick jab of stinger.' });
move('silkwrap', 'Silk Wrap', 'insect', 'status', 0, 95, 20, {
  target: 'foe',
  effect: { boost: { spe: -2 }, target: 'foe' },
  desc: 'Binds the foe’s legs in silk.',
});
move('mandible', 'Mandible', 'insect', 'physical', 75, 95, 15, {
  bite: true,
  desc: 'Shears with heavy jaws.',
});
move('swarmrush', 'Swarm Rush', 'insect', 'physical', 20, 95, 20, {
  effect: { multiHit: [2, 5] },
  desc: 'A hail of small bodies.',
});
move('psybug', 'Psybug', 'insect', 'special', 90, 100, 10, {
  effect: { boost: { spa: -1 }, target: 'foe', chance: 20 },
  desc: 'A resonant buzz that muddles the mind.',
});
move('hivecall', 'Hive Call', 'insect', 'status', 0, 0, 15, {
  sound: true,
  effect: { boost: { atk: 1, spe: 1 } },
  desc: 'Summons the hive’s courage.',
});
move('carapace', 'Carapace', 'insect', 'status', 0, 0, 20, {
  effect: { boost: { def: 2, spe: -1 } },
  desc: 'Thickens its shell at the cost of speed.',
});
move('devourbite', 'Devour Bite', 'insect', 'physical', 85, 100, 10, {
  bite: true,
  effect: { drain: 0.5 },
  desc: 'Feeds directly on the foe.',
});

// ── Mind ───────────────────────────────────────────────────────────────────
move('confuse', 'Confuse', 'mind', 'status', 0, 100, 10, {
  target: 'foe',
  effect: { status: 'confusion', chance: 100 },
  desc: 'Muddles the foe’s sense of direction.',
});
move('psywave', 'Psywave', 'mind', 'special', 50, 100, 25, { desc: 'A pulse of raw thought.' });
move('mindspike', 'Mind Spike', 'mind', 'special', 75, 100, 20, {
  effect: { boost: { spd: -1 }, target: 'foe', chance: 20 },
  desc: 'A needle of will.',
});
move('psystrike', 'Psystrike', 'mind', 'special', 100, 95, 10, {
  effect: { boost: { spd: -1 }, target: 'foe', chance: 10 },
  desc: 'A hammer of thought.',
});
move('mindbreak', 'Mind Break', 'mind', 'special', 130, 80, 5, {
  effect: { selfBoost: { spa: -2 } },
  desc: 'Empties the mind into one blow.',
});
move('hypnosis', 'Hypnosis', 'mind', 'status', 0, 65, 15, {
  target: 'foe',
  effect: { status: 'sleep', chance: 100 },
  desc: 'Lulls the foe to sleep. Unreliable.',
});
move('barrier', 'Barrier', 'mind', 'status', 0, 0, 15, {
  effect: { screen: 'reflect' },
  desc: 'Halves physical damage for five turns.',
});
move('lightscreen', 'Light Screen', 'mind', 'status', 0, 0, 15, {
  effect: { screen: 'lightscreen' },
  desc: 'Halves special damage for five turns.',
});
move('foresight', 'Foresight', 'mind', 'status', 0, 0, 15, {
  effect: { boost: { spa: 1, spe: 1 } },
  desc: 'Reads the flow of the fight.',
});
move('teleport', 'Teleport', 'mind', 'status', 0, 0, 20, {
  priority: -6,
  effect: { fleeField: true },
  desc: 'Slips away from a wild battle.',
});

// ── Spirit ─────────────────────────────────────────────────────────────────
move('wisp', 'Wisp', 'spirit', 'special', 45, 100, 25, { desc: 'A drifting cold light.' });
move('hex', 'Hex', 'spirit', 'special', 65, 100, 15, {
  effect: { doubleIfStatus: true },
  desc: 'Doubles in power against a statused foe.',
});
move('phantomgrip', 'Phantom Grip', 'spirit', 'physical', 80, 100, 15, {
  effect: { boost: { def: -1 }, target: 'foe', chance: 20 },
  desc: 'Reaches through armour.',
});
move('soulrend', 'Soul Rend', 'spirit', 'special', 100, 95, 10, {
  effect: { drain: 0.5 },
  desc: 'Takes something the foe cannot spare.',
});
move('lastrites', 'Last Rites', 'spirit', 'special', 130, 80, 5, {
  effect: { selfBoost: { spd: -1 } },
  desc: 'A final, formal grief.',
});
move('willowisp', 'Will-o-Wisp', 'spirit', 'status', 0, 85, 15, {
  target: 'foe',
  effect: { status: 'burn', chance: 100 },
  desc: 'Sets a cold flame on the foe.',
});
move('shadowveil', 'Shadow Veil', 'spirit', 'status', 0, 0, 20, {
  effect: { boost: { spd: 1, spe: 1 } },
  desc: 'Thins itself into the dark.',
});
move('memorial', 'Memorial', 'spirit', 'status', 0, 0, 10, {
  effect: { heal: 0.5 },
  desc: 'Remembers itself whole again.',
});

// ── Umbra ──────────────────────────────────────────────────────────────────
move('shadowclaw', 'Shadow Claw', 'umbra', 'physical', 70, 100, 15, {
  effect: { critStage: 1 },
  desc: 'A claw that comes from the wrong angle.',
});
move('nightsting', 'Night Sting', 'umbra', 'physical', 50, 100, 25, { desc: 'A strike out of the dark.' });
move('darkpulse', 'Dark Pulse', 'umbra', 'special', 85, 100, 15, {
  effect: { flinch: 20 },
  desc: 'A wave of bad intent.',
});
move('eclipse', 'Eclipse', 'umbra', 'special', 110, 90, 10, {
  effect: { boost: { spa: -1 }, target: 'foe', chance: 30 },
  desc: 'Blots out the light.',
});
move('voidfang', 'Void Fang', 'umbra', 'physical', 120, 85, 5, {
  bite: true,
  effect: { drain: 0.4 },
  desc: 'Bites away a piece of the foe.',
});
move('feint', 'Feint', 'umbra', 'physical', 45, 100, 20, {
  priority: 2,
  effect: { breakProtect: true },
  desc: 'Strikes first and cuts through Protect.',
});
move('nastyplot', 'Nasty Plot', 'umbra', 'status', 0, 0, 20, {
  effect: { boost: { spa: 2 } },
  desc: 'Thinks of something awful. Sharply raises Sp. Atk.',
});
move('taunt', 'Taunt', 'umbra', 'status', 0, 100, 20, {
  target: 'foe',
  effect: { taunt: 3 },
  desc: 'Goads the foe into attacking only.',
});
move('thief', 'Thief', 'umbra', 'physical', 60, 100, 15, {
  effect: { steal: true },
  desc: 'Steals the foe’s held item, if it has one.',
});

// ── Radiant ────────────────────────────────────────────────────────────────
move('glimmer', 'Glimmer', 'radiant', 'special', 45, 100, 25, { desc: 'A soft flare of light.' });
move('lightlance', 'Light Lance', 'radiant', 'special', 75, 100, 20, { desc: 'A spear of daylight.' });
move('dawnbreak', 'Dawnbreak', 'radiant', 'special', 95, 100, 10, {
  effect: { boost: { spd: -1 }, target: 'foe', chance: 20 },
  desc: 'The first light over the ridge.',
});
move('judgement', 'Judgement', 'radiant', 'special', 120, 90, 5, {
  effect: { critStage: 1 },
  desc: 'A verdict delivered in light.',
});
move('blessing', 'Blessing', 'radiant', 'status', 0, 0, 10, {
  effect: { heal: 0.5, cureStatus: true },
  desc: 'Heals half its HP and clears status.',
});
move('purifyray', 'Purify Ray', 'radiant', 'status', 0, 0, 15, {
  effect: { boost: { spa: 1, spd: 1 } },
  desc: 'Gathers light close.',
});
move('sanctuary', 'Sanctuary', 'radiant', 'status', 0, 0, 10, {
  effect: { screen: 'sanctuary' },
  desc: 'Wards the party against status for five turns.',
});
move('flashbang', 'Flashbang', 'radiant', 'status', 0, 100, 15, {
  target: 'foe',
  effect: { boost: { spe: -1, spa: -1 }, target: 'foe' },
  desc: 'A burst of light that leaves the foe blinking.',
});

// ── Chaos ──────────────────────────────────────────────────────────────────
move('fraybolt', 'Fraybolt', 'chaos', 'special', 60, 100, 20, {
  effect: { status: 'fray', chance: 20 },
  desc: 'A loose thread of the Weave.',
});
move('unweave', 'Unweave', 'chaos', 'special', 90, 95, 10, {
  effect: { boost: { spd: -1 }, target: 'foe', chance: 30 },
  desc: 'Pulls at what holds the foe together.',
});
move('discord', 'Discord', 'chaos', 'special', 110, 85, 10, {
  effect: { status: 'confusion', chance: 30 },
  desc: 'A note the world was not meant to hold.',
});
move('collapse', 'Collapse', 'chaos', 'physical', 130, 80, 5, {
  effect: { recoil: 0.25 },
  desc: 'Folds a piece of the world onto the foe.',
});
move('entropy', 'Entropy', 'chaos', 'status', 0, 100, 10, {
  target: 'foe',
  effect: { status: 'fray', chance: 100 },
  desc: 'Frays the foe — it loses HP and cannot be healed fully.',
});
move('rewrite', 'Rewrite', 'chaos', 'status', 0, 0, 5, {
  effect: { resetBoosts: true, boost: { spa: 1, spe: 1 } },
  desc: 'Wipes the field’s stat changes and reasserts itself.',
});
move('weavetear', 'Weave Tear', 'chaos', 'special', 100, 100, 5, {
  effect: { ignoreImmunity: true },
  signature: true,
  desc: 'Cuts through anything, resistance or not.',
});

// ── Signature legendary moves ──────────────────────────────────────────────
move('firstlight', 'First Light', 'radiant', 'special', 140, 90, 5, {
  signature: true,
  effect: { cureParty: true },
  desc: 'The dawn that started everything.',
});
move('longnight', 'Long Night', 'umbra', 'special', 140, 90, 5, {
  signature: true,
  effect: { status: 'sleep', chance: 30 },
  desc: 'The dark that has been patient.',
});
move('worldsong', 'Worldsong', 'verdant', 'special', 130, 95, 5, {
  signature: true,
  sound: true,
  effect: { heal: 0.25 },
  desc: 'The note the roots hum under everything.',
});
move('finalthread', 'Final Thread', 'chaos', 'special', 150, 85, 5, {
  signature: true,
  effect: { selfBoost: { spa: -2 }, ignoreImmunity: true },
  desc: 'Everything the Weave has left, at once.',
});

export const MOVES = M;
export const MOVE_IDS = Object.keys(M);

export function getMove(id) {
  return M[id] || null;
}

/** All moves of a given type, optionally filtered by category. */
export function movesOfType(type, category = null) {
  return MOVE_IDS.filter(
    (id) => M[id].type === type && (!category || M[id].category === category) && !M[id].signature
  );
}

/** A fresh battle-ready copy of a move slot (tracks PP separately). */
export function makeMoveSlot(id) {
  const m = getMove(id);
  if (!m) return null;
  return { id, pp: m.pp, maxPp: m.pp };
}
