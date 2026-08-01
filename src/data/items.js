// Every item in the game. `price` of 0 means it cannot be bought; `sell` is
// what a shop pays for it (defaults to half the price).
//
// use.where — 'battle' | 'field' | 'both' | null (not directly usable)
// use.target — 'party' (pick a creature) | 'self' (no target) | 'foe'

const I = {};

function item(id, name, category, price, opts = {}) {
  I[id] = {
    id,
    name,
    category,
    price,
    sell: opts.sell !== undefined ? opts.sell : Math.floor(price / 2),
    desc: opts.desc || '',
    where: opts.where || null,
    target: opts.target || 'party',
    effect: opts.effect || null,
    hold: opts.hold || null,
    key: !!opts.key,
    consumable: opts.consumable !== undefined ? opts.consumable : !opts.key,
    sort: opts.sort || 0,
  };
  return I[id];
}

// ── Capture orbs ───────────────────────────────────────────────────────────
item('orb', 'Weave Orb', 'capture', 200, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 1 },
  desc: 'A standard orb for catching wild creatures.',
  sort: 1,
});
item('greatorb', 'Great Orb', 'capture', 600, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 1.5 },
  desc: 'A better orb. Catches more reliably than a Weave Orb.',
  sort: 2,
});
item('ultraorb', 'Ultra Orb', 'capture', 1200, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 2 },
  desc: 'A high-performance orb with a much better catch rate.',
  sort: 3,
});
item('duskorb', 'Dusk Orb', 'capture', 1000, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 1, capture_night: 3.2, capture_cave: 3.2 },
  desc: 'Works far better at night or underground.',
  sort: 4,
});
item('netorb', 'Net Orb', 'capture', 1000, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 1, capture_types: { insect: 3.2, tide: 3.2 } },
  desc: 'Specialised for Insect and Tide creatures.',
  sort: 5,
});
item('healorb', 'Heal Orb', 'capture', 900, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 1.2, healOnCatch: true },
  desc: 'Fully restores the creature it catches.',
  sort: 6,
});
item('timerorb', 'Timer Orb', 'capture', 1000, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 1, capture_turnScaling: 0.3 },
  desc: 'Grows more effective the longer the battle runs.',
  sort: 7,
});
item('luxeorb', 'Luxe Orb', 'capture', 1500, {
  where: 'battle',
  target: 'foe',
  effect: { capture: 1, friendshipBonus: 60 },
  desc: 'The creature caught in it starts out very fond of you.',
  sort: 8,
});
item('masterorb', 'Sovereign Orb', 'capture', 0, {
  sell: 0,
  where: 'battle',
  target: 'foe',
  effect: { capture: 255 },
  desc: 'Catches any wild creature without fail. There is only one.',
  sort: 9,
});

// ── Healing ────────────────────────────────────────────────────────────────
item('potion', 'Salve', 'heal', 200, {
  where: 'both',
  effect: { heal: 30 },
  desc: 'Restores 30 HP to one creature.',
  sort: 10,
});
item('superpotion', 'Strong Salve', 'heal', 600, {
  where: 'both',
  effect: { heal: 80 },
  desc: 'Restores 80 HP to one creature.',
  sort: 11,
});
item('hyperpotion', 'Master Salve', 'heal', 1100, {
  where: 'both',
  effect: { heal: 160 },
  desc: 'Restores 160 HP to one creature.',
  sort: 12,
});
item('fullrestore', 'Full Restore', 'heal', 2400, {
  where: 'both',
  effect: { heal: 'full', cure: 'all' },
  desc: 'Fully restores HP and clears any status condition.',
  sort: 13,
});
item('revive', 'Revive', 'heal', 1400, {
  where: 'both',
  effect: { revive: 0.5 },
  desc: 'Revives a fainted creature with half its HP.',
  sort: 14,
});
item('maxrevive', 'Full Revive', 'heal', 3600, {
  where: 'both',
  effect: { revive: 1 },
  desc: 'Revives a fainted creature at full HP.',
  sort: 15,
});
item('ether', 'Ether Draught', 'heal', 800, {
  where: 'both',
  effect: { pp: 10 },
  desc: 'Restores 10 PP to one move.',
  sort: 16,
});
item('maxether', 'Ether Flask', 'heal', 1800, {
  where: 'both',
  effect: { pp: 'full' },
  desc: 'Fully restores the PP of one move.',
  sort: 17,
});
item('elixir', 'Elixir', 'heal', 2600, {
  where: 'both',
  effect: { ppAll: 10 },
  desc: 'Restores 10 PP to every move.',
  sort: 18,
});

// ── Status cures ───────────────────────────────────────────────────────────
item('burnsalve', 'Burn Salve', 'status', 250, {
  where: 'both',
  effect: { cure: ['burn'] },
  desc: 'Cures a burn.',
  sort: 20,
});
item('icemelt', 'Thaw Flask', 'status', 250, {
  where: 'both',
  effect: { cure: ['freeze'] },
  desc: 'Thaws a frozen creature.',
  sort: 21,
});
item('antidote', 'Antidote', 'status', 200, {
  where: 'both',
  effect: { cure: ['poison', 'toxic'] },
  desc: 'Cures poison of any severity.',
  sort: 22,
});
item('paralyzeheal', 'Nerve Tonic', 'status', 250, {
  where: 'both',
  effect: { cure: ['paralysis'] },
  desc: 'Cures paralysis.',
  sort: 23,
});
item('awakening', 'Rouser', 'status', 200, {
  where: 'both',
  effect: { cure: ['sleep'] },
  desc: 'Wakes a sleeping creature.',
  sort: 24,
});
item('clearmind', 'Clarity Bell', 'status', 300, {
  where: 'both',
  effect: { cure: ['confusion', 'fray'] },
  desc: 'Clears confusion and Weave-fray.',
  sort: 25,
});
item('fullheal', 'Panacea', 'status', 700, {
  where: 'both',
  effect: { cure: 'all' },
  desc: 'Cures any status condition.',
  sort: 26,
});

// ── Battle-only boosters ───────────────────────────────────────────────────
item('xattack', 'Attack Draught', 'battle', 500, {
  where: 'battle',
  target: 'self',
  effect: { boost: { atk: 2 } },
  desc: 'Sharply raises the active creature’s Attack for one battle.',
  sort: 30,
});
item('xdefense', 'Guard Draught', 'battle', 500, {
  where: 'battle',
  target: 'self',
  effect: { boost: { def: 2 } },
  desc: 'Sharply raises Defense for one battle.',
  sort: 31,
});
item('xspecial', 'Focus Draught', 'battle', 550, {
  where: 'battle',
  target: 'self',
  effect: { boost: { spa: 2 } },
  desc: 'Sharply raises Sp. Atk for one battle.',
  sort: 32,
});
item('xspeed', 'Swift Draught', 'battle', 550, {
  where: 'battle',
  target: 'self',
  effect: { boost: { spe: 2 } },
  desc: 'Sharply raises Speed for one battle.',
  sort: 33,
});
item('guardspec', 'Ward Charm', 'battle', 600, {
  where: 'battle',
  target: 'self',
  effect: { screen: 'sanctuary' },
  desc: 'Blocks status conditions for five turns.',
  sort: 34,
});
item('smokebomb', 'Smoke Bomb', 'battle', 300, {
  where: 'battle',
  target: 'self',
  effect: { flee: true },
  desc: 'Guarantees escape from a wild battle.',
  sort: 35,
});

// ── Field aids ─────────────────────────────────────────────────────────────
item('repel', 'Ward Incense', 'field', 400, {
  where: 'field',
  target: 'self',
  effect: { repel: 200 },
  desc: 'Keeps weaker wild creatures away for 200 steps.',
  sort: 40,
});
item('maxrepel', 'Great Incense', 'field', 800, {
  where: 'field',
  target: 'self',
  effect: { repel: 500 },
  desc: 'Keeps weaker wild creatures away for 500 steps.',
  sort: 41,
});
item('lure', 'Sweet Lure', 'field', 500, {
  where: 'field',
  target: 'self',
  effect: { lure: 200 },
  desc: 'Doubles the wild encounter rate for 200 steps.',
  sort: 42,
});
item('escaperope', 'Waystone', 'field', 550, {
  where: 'field',
  target: 'self',
  effect: { escape: true },
  desc: 'Returns you to the last town you rested in.',
  sort: 43,
});
item('tent', 'Camp Kit', 'field', 1200, {
  where: 'field',
  target: 'self',
  effect: { restParty: true },
  desc: 'Makes camp and fully restores the whole party. Single use.',
  sort: 44,
});

// ── Vitamins and training ──────────────────────────────────────────────────
const VITAMINS = [
  ['hpup', 'Vital Draught', 'hp', 'HP'],
  ['protein', 'Sinew Draught', 'atk', 'Attack'],
  ['iron', 'Iron Draught', 'def', 'Defense'],
  ['calcium', 'Mind Draught', 'spa', 'Sp. Atk'],
  ['zinc', 'Spirit Draught', 'spd', 'Sp. Def'],
  ['carbos', 'Fleet Draught', 'spe', 'Speed'],
];
VITAMINS.forEach(([id, name, stat, label], i) => {
  item(id, name, 'training', 3000, {
    where: 'field',
    effect: { train: stat, amount: 10 },
    desc: `Permanently raises a creature's ${label} training by 10.`,
    sort: 50 + i,
  });
});
item('rarecandy', 'Sunburst Sweet', 'training', 0, {
  sell: 2400,
  where: 'field',
  effect: { levelUp: 1 },
  desc: 'Raises a creature one level instantly.',
  sort: 56,
});
item('friendbell', 'Friendship Bell', 'training', 2000, {
  where: 'field',
  effect: { friendship: 40 },
  desc: 'Raises how much a creature likes you.',
  sort: 57,
});
item('abilitycapsule', 'Latent Capsule', 'training', 6000, {
  where: 'field',
  effect: { swapAbility: true },
  desc: 'Switches a creature to its other ordinary ability.',
  sort: 58,
});
item('hiddencapsule', 'Deep Capsule', 'training', 0, {
  sell: 4000,
  where: 'field',
  effect: { hiddenAbility: true },
  desc: 'Draws out a creature’s hidden ability.',
  sort: 59,
});
item('naturemint', 'Nature Mint', 'training', 4000, {
  where: 'field',
  effect: { rerollNature: true },
  desc: 'Settles a creature into a new nature.',
  sort: 60,
});

// ── Evolution items ────────────────────────────────────────────────────────
const STONES = [
  ['flame_shard', 'Flame Shard', 'A shard that still remembers a forge.'],
  ['tide_stone', 'Tide Stone', 'Wet to the touch, always.'],
  ['moss_stone', 'Moss Stone', 'Something is growing on it. Something is growing in it.'],
  ['storm_shard', 'Storm Shard', 'It clicks quietly before rain.'],
  ['frost_shard', 'Frost Shard', 'It has never once melted.'],
  ['dawn_stone', 'Dawn Stone', 'Holds one morning inside it.'],
  ['dusk_stone', 'Dusk Stone', 'Holds the hour after that morning.'],
  ['iron_core', 'Iron Core', 'A seed of worked metal.'],
  ['grave_candle', 'Grave Candle', 'Lit once, four centuries ago.'],
  ['weave_knot', 'Weave Knot', 'A tangle of the world, tied off neatly.'],
];
STONES.forEach(([id, name, desc], i) => {
  item(id, name, 'evolution', 3000, {
    where: 'field',
    effect: { evolutionStone: id },
    desc,
    sort: 70 + i,
  });
});

// ── Held items ─────────────────────────────────────────────────────────────
item('leftovers', 'Trail Rations', 'held', 3000, {
  hold: { endTurnHeal: 1 / 16 },
  desc: 'The holder recovers a little HP each turn.',
  consumable: false,
  sort: 80,
});
item('lifeorb', 'Reckless Charm', 'held', 3200, {
  hold: { damageMult: 1.3, recoil: 0.1 },
  desc: 'Boosts damage by 30% but the holder takes 10% recoil.',
  consumable: false,
  sort: 81,
});
item('choiceband', 'Bound Band', 'held', 3200, {
  hold: { statMult: { atk: 1.5 }, lockMove: true },
  desc: 'Attack rises by half, but only one move can be used.',
  consumable: false,
  sort: 82,
});
item('choicespecs', 'Bound Lens', 'held', 3200, {
  hold: { statMult: { spa: 1.5 }, lockMove: true },
  desc: 'Sp. Atk rises by half, but only one move can be used.',
  consumable: false,
  sort: 83,
});
item('choicescarf', 'Bound Scarf', 'held', 3200, {
  hold: { statMult: { spe: 1.5 }, lockMove: true },
  desc: 'Speed rises by half, but only one move can be used.',
  consumable: false,
  sort: 84,
});
item('focussash', 'Last Knot', 'held', 2600, {
  hold: { survive: true },
  desc: 'Lets the holder survive one knockout blow from full HP.',
  sort: 85,
});
item('assaultvest', 'Padded Vest', 'held', 3000, {
  hold: { statMult: { spd: 1.5 }, noStatus: true },
  desc: 'Sp. Def rises by half, but status moves cannot be used.',
  consumable: false,
  sort: 86,
});
item('eviolite', 'Unfinished Charm', 'held', 3000, {
  hold: { unevolvedDefBoost: 1.5 },
  desc: 'Raises the defenses of a creature that can still evolve.',
  consumable: false,
  sort: 87,
});
item('luckyegg', 'Gilded Egg', 'held', 0, {
  sell: 3000,
  hold: { expMult: 1.5 },
  desc: 'The holder earns 50% more experience.',
  consumable: false,
  sort: 88,
});
item('amulet', 'Coin Amulet', 'held', 0, {
  sell: 3000,
  hold: { moneyMult: 2 },
  desc: 'Doubles the money earned from trainer battles.',
  consumable: false,
  sort: 89,
});
item('quickclaw', 'Quick Claw', 'held', 2400, {
  hold: { quickChance: 0.2 },
  desc: 'Sometimes lets the holder move first.',
  consumable: false,
  sort: 90,
});
item('berrysweet', 'Sugar Berry', 'held', 400, {
  hold: { pinchHeal: 0.25 },
  desc: 'Restores a quarter of HP when the holder is badly hurt.',
  sort: 91,
});
item('cleanseberry', 'Clear Berry', 'held', 400, {
  hold: { cureStatus: true },
  desc: 'Cures the holder’s status condition once.',
  sort: 92,
});
const TYPE_GEMS = [
  ['ember_gem', 'Ember Gem', 'ember'],
  ['tide_gem', 'Tide Gem', 'tide'],
  ['verdant_gem', 'Verdant Gem', 'verdant'],
  ['volt_gem', 'Volt Gem', 'volt'],
  ['umbra_gem', 'Umbra Gem', 'umbra'],
  ['radiant_gem', 'Radiant Gem', 'radiant'],
];
TYPE_GEMS.forEach(([id, name, type], i) => {
  item(id, name, 'held', 2000, {
    hold: { typeBoost: type, typeMult: 1.25 },
    desc: `Raises the power of the holder's ${type} moves.`,
    consumable: false,
    sort: 93 + i,
  });
});

// ── Move tomes (teach a move) ──────────────────────────────────────────────
const TOMES = [
  ['tome_flamethrower', 'flamethrower', 3500],
  ['tome_watercannon', 'watercannon', 3500],
  ['tome_megadrain', 'megadrain', 3000],
  ['tome_voltbeam', 'voltbeam', 3500],
  ['tome_frostbeam', 'frostbeam', 3500],
  ['tome_aircutter', 'aircutter', 2500],
  ['tome_stoneedge', 'stoneedge', 4000],
  ['tome_ironhead', 'ironhead', 3000],
  ['tome_sludgewave', 'sludgewave', 3000],
  ['tome_crunch', 'crunch', 3000],
  ['tome_psystrike', 'psystrike', 4000],
  ['tome_darkpulse', 'darkpulse', 3500],
  ['tome_dawnbreak', 'dawnbreak', 3500],
  ['tome_protect', 'protect', 2000],
  ['tome_rest', 'rest', 2000],
  ['tome_recover', 'recover', 4500],
  ['tome_toxify', 'toxify', 2500],
  ['tome_willowisp', 'willowisp', 2500],
  ['tome_calmmind', 'calmmind', 3000],
  ['tome_bulkup', 'bulkup', 3000],
  ['tome_quake', 'quake', 4000],
  ['tome_unweave', 'unweave', 5000],
];

// Tome display names are filled in lazily from the move list to avoid a
// circular import at module load.
TOMES.forEach(([id, moveId, price], i) => {
  item(id, `Tome: ${moveId}`, 'tome', price, {
    where: 'field',
    effect: { teach: moveId },
    desc: 'Teaches a move to a creature that can learn it.',
    consumable: false,
    sort: 110 + i,
  });
});

// ── Treasure (sell-only) ───────────────────────────────────────────────────
item('nugget', 'Gold Nugget', 'treasure', 0, { sell: 5000, desc: 'Sells for a great deal. Nothing else.', sort: 140 });
item('pearl', 'Tide Pearl', 'treasure', 0, { sell: 1400, desc: 'A shop will pay well for it.', sort: 141 });
item('bigpearl', 'Deep Pearl', 'treasure', 0, { sell: 4000, desc: 'Larger than a fist. Warm.', sort: 142 });
item('starpiece', 'Skyshard', 'treasure', 0, { sell: 4900, desc: 'A piece of something that fell.', sort: 143 });
item('relic', 'Old Coin', 'treasure', 0, { sell: 2200, desc: 'Minted by a kingdom nobody remembers.', sort: 144 });
item('scrap', 'Scrap Metal', 'treasure', 0, { sell: 300, desc: 'The forge buys it by weight.', sort: 145 });
item('herb', 'Bitter Herb', 'treasure', 120, { sell: 60, desc: 'An ingredient. Apothecaries want them.', sort: 146 });

// ── Key items ──────────────────────────────────────────────────────────────
item('dex', 'Weave Ledger', 'key', 0, {
  key: true,
  desc: 'Records every creature you meet and everything known about it.',
  sort: 200,
});
item('rod', 'Old Rod', 'key', 0, {
  key: true,
  where: 'field',
  target: 'self',
  effect: { fish: 1 },
  desc: 'Fish for creatures from any shoreline.',
  sort: 201,
});
item('goodrod', 'Deep Rod', 'key', 0, {
  key: true,
  where: 'field',
  target: 'self',
  effect: { fish: 2 },
  desc: 'Reaches creatures the Old Rod never could.',
  sort: 202,
});
item('lantern', 'Warden Lantern', 'key', 0, {
  key: true,
  desc: 'Lights the deep places. Some doors only open for it.',
  sort: 203,
});
item('pickaxe', 'Quarry Pick', 'key', 0, {
  key: true,
  desc: 'Breaks the cracked rock that blocks some tunnels.',
  sort: 204,
});
item('ferrypass', 'Ferry Pass', 'key', 0, {
  key: true,
  desc: 'The Tidefall ferry will take you anywhere it goes.',
  sort: 205,
});
item('siphon_plans', 'Siphon Schematics', 'key', 0, {
  key: true,
  desc: 'Stolen plans for the Compact’s essence siphon.',
  sort: 206,
});
item('warden_seal', 'Warden Seal', 'key', 0, {
  key: true,
  desc: 'Proof you have passed a Warden’s trial. Collect them all.',
  sort: 207,
});
item('heartwood_key', 'Heartwood Key', 'key', 0, {
  key: true,
  desc: 'A knot of living wood that opens the Heartwood gate.',
  sort: 208,
});
item('riftglass', 'Riftglass', 'key', 0, {
  key: true,
  desc: 'Look through it and the tears in the Weave become visible.',
  sort: 209,
});

export const ITEMS = I;
export const ITEM_IDS = Object.keys(I);

export function getItem(id) {
  return I[id] || null;
}

export function itemsInCategory(category) {
  return ITEM_IDS.filter((id) => I[id].category === category).sort((a, b) => I[a].sort - I[b].sort);
}

/** Price a shop pays for one unit. */
export function sellPrice(id) {
  const it = I[id];
  return it ? it.sell : 0;
}

/** Fills in readable names for the move tomes. Called once by the boot code. */
export function labelTomes(moveTable) {
  for (const id of ITEM_IDS) {
    const it = I[id];
    if (it.category === 'tome' && it.effect && it.effect.teach) {
      const mv = moveTable[it.effect.teach];
      if (mv) {
        it.name = `Tome: ${mv.name}`;
        it.desc = `Teaches ${mv.name} to a creature that can learn it.`;
        it.moveType = mv.type;
      }
    }
  }
}
