// The Adventurer Guild: everything that survives a run. Gold, the people, the
// cards you are allowed to draw, and the wall of names of those who did not
// come back.

import { CARDS, CARD_BY_ID, STARTER_CARDS } from '../data/cards.js';
import { CLASSES } from '../data/classes.js';
import { GEAR_BY_ID, GRADE_ORDER, GRADE_VALUE, SLOTS, gearFor } from '../data/equipment.js';
import { TRAITS } from '../data/traits.js';
import { createAdventurer, refreshStats } from './actors.js';

export const SAVE_KEY = 'deckdelve.guild.v2';
export const DECK_LIMIT = 20;
export const ROSTER_LIMIT = 7;
export const PARTY_LIMIT = 4;

/**
 * Every card the guild can buy, priced by how much trouble it causes. Starter
 * cards are on the list too — a second Stone Hall is often exactly what a deck
 * is short of.
 */
export const CARD_SHOP = CARDS.map((c) => ({
  id: c.id,
  kind: 'card',
  name: c.name,
  tier: c.tier || 0,
  cost: Math.round(
    (120 + (c.tier || 0) * 190 + (c.threat || 0) * 26 + (c.unique ? 260 : 0)) *
      (STARTER_CARDS.includes(c.id) ? 0.45 : 1),
  ),
  blurb: c.blurb,
}));

export const CLASS_SHOP = Object.values(CLASSES)
  .filter((c) => c.locked)
  .map((c) => ({ id: c.id, kind: 'class', name: c.name, cost: 900, blurb: c.blurb }));

export const UPGRADES = [
  {
    id: 'insurance_1', kind: 'upgrade', name: 'Scavenger Contract', cost: 420,
    blurb: 'A standing arrangement with people who go in after you. Recover 35% of a lost haul instead of 15%.',
    apply: (g) => { g.insurance = 0.35; },
  },
  {
    id: 'insurance_2', kind: 'upgrade', name: 'Better Scavengers', cost: 1100, requires: 'insurance_1',
    blurb: 'Recover 60% of a lost haul. They are not cheap and they are not nice.',
    apply: (g) => { g.insurance = 0.6; },
  },
  {
    id: 'wide_hand', kind: 'upgrade', name: 'Cartographer’s Table', cost: 650,
    blurb: 'Hold six room cards instead of five.',
    apply: (g) => { g.handSize = 6; },
  },
  {
    id: 'fast_draw', kind: 'upgrade', name: 'Runner Boys', cost: 540,
    blurb: 'Cards come to hand every 6 seconds instead of every 9.',
    apply: (g) => { g.drawInterval = 6; },
  },
  {
    id: 'quartermaster', kind: 'upgrade', name: 'Quartermaster', cost: 700,
    blurb: 'Every recruit walks in already wearing something common.',
    apply: (g) => { g.startingGear = 'common'; },
  },
  {
    id: 'training_yard', kind: 'upgrade', name: 'Training Yard', cost: 1500,
    blurb: 'New recruits start at level 3. Old hands are unimpressed.',
    apply: (g) => { g.startingLevel = 3; },
  },
  {
    id: 'surveyors', kind: 'upgrade', name: 'Surveyor’s Charts', cost: 480,
    blurb: 'Start each expedition knowing what is in the first room you build.',
    apply: (g) => { g.startScouted = 1; },
  },
  {
    id: 'field_chapel', kind: 'upgrade', name: 'Field Chapel', cost: 820,
    blurb: 'Everyone goes in with a Blessing that lasts the first minute.',
    apply: (g) => { g.startBless = 60; },
  },
];

export const SHOP = [...CARD_SHOP, ...CLASS_SHOP, ...UPGRADES];

export function newGuild(rng) {
  const guild = {
    version: 2,
    gold: 180,
    runs: 0,
    wins: 0,
    deepest: 0,
    bossKills: 0,
    insurance: 0.15,
    handSize: 5,
    drawInterval: 9,
    startingGear: null,
    startingLevel: 1,
    startScouted: 0,
    startBless: 0,
    sound: true,
    owned: {},
    classes: Object.values(CLASSES).filter((c) => !c.locked).map((c) => c.id),
    upgrades: [],
    roster: [],
    party: [],
    stash: [],
    deck: [],
    fallen: [],
    story: [],
  };
  for (const id of STARTER_CARDS) guild.owned[id] = (guild.owned[id] || 0) + 1;
  guild.deck = STARTER_CARDS.slice();
  for (let i = 0; i < 4; i++) {
    const classId = ['fighter', 'rogue', 'mage', 'cleric'][i];
    guild.roster.push(createAdventurer(rng, { classId }));
  }
  guild.party = guild.roster.slice(0, PARTY_LIMIT).map((a) => a.id);
  return guild;
}

export function hireCost(guild) {
  return 140 + guild.roster.length * 95;
}

export function ownedCopies(guild, cardId) {
  return guild.owned[cardId] || 0;
}

export function copiesInDeck(guild, cardId) {
  return guild.deck.filter((id) => id === cardId).length;
}

export function addToDeck(guild, cardId) {
  if (guild.deck.length >= DECK_LIMIT) return 'Deck is full.';
  if (copiesInDeck(guild, cardId) >= ownedCopies(guild, cardId)) return 'You do not own another copy.';
  guild.deck.push(cardId);
  return null;
}

export function removeFromDeck(guild, cardId) {
  const i = guild.deck.lastIndexOf(cardId);
  if (i < 0) return 'Not in the deck.';
  guild.deck.splice(i, 1);
  return null;
}

export function canBuy(guild, entry) {
  if (guild.gold < entry.cost) return 'Not enough gold.';
  if (entry.requires && !guild.upgrades.includes(entry.requires)) return 'Something else comes first.';
  if (entry.kind === 'upgrade' && guild.upgrades.includes(entry.id)) return 'Already bought.';
  if (entry.kind === 'class' && guild.classes.includes(entry.id)) return 'Already recruiting those.';
  if (entry.kind === 'card' && ownedCopies(guild, entry.id) >= 3) return 'Three copies is the limit.';
  return null;
}

export function buy(guild, entry) {
  const reason = canBuy(guild, entry);
  if (reason) return reason;
  guild.gold -= entry.cost;
  if (entry.kind === 'card') guild.owned[entry.id] = ownedCopies(guild, entry.id) + 1;
  if (entry.kind === 'class') guild.classes.push(entry.id);
  if (entry.kind === 'upgrade') {
    guild.upgrades.push(entry.id);
    entry.apply(guild);
  }
  return null;
}

export function hire(guild, rng, classId) {
  if (guild.roster.length >= ROSTER_LIMIT) return 'The guild hall is full.';
  const cost = hireCost(guild);
  if (guild.gold < cost) return 'Not enough gold.';
  guild.gold -= cost;
  const adv = createAdventurer(rng, {
    classId: classId || rng.pick(guild.classes),
    level: guild.startingLevel || 1,
  });
  if (guild.startingGear) {
    const pool = gearFor(adv.classId, guild.startingGear);
    for (const slot of SLOTS) {
      const options = pool.filter((g) => g.slot === slot);
      if (options.length) adv.equipment[slot] = rng.pick(options).id;
    }
    refreshStats(adv);
    adv.hp = adv.maxHp;
  }
  guild.roster.push(adv);
  return null;
}

export function dismiss(guild, advId) {
  guild.roster = guild.roster.filter((a) => a.id !== advId);
  guild.party = guild.party.filter((id) => id !== advId);
}

export function togglePartyMember(guild, advId) {
  const i = guild.party.indexOf(advId);
  if (i >= 0) {
    guild.party.splice(i, 1);
    return null;
  }
  if (guild.party.length >= PARTY_LIMIT) return 'Four go in. That is the arrangement.';
  guild.party.push(advId);
  return null;
}

export function partyMembers(guild) {
  return guild.party.map((id) => guild.roster.find((a) => a.id === id)).filter(Boolean);
}

/** Gives a piece of stashed gear to somebody, returning whatever they swap out. */
export function equip(guild, adv, gearId) {
  const gear = GEAR_BY_ID[gearId];
  if (!gear) return 'No such thing.';
  if (gear.for && !gear.for.includes(adv.classId)) return `${adv.name} cannot use that.`;
  const i = guild.stash.indexOf(gearId);
  if (i < 0) return 'Not in the stash.';
  guild.stash.splice(i, 1);
  const previous = adv.equipment[gear.slot];
  adv.equipment[gear.slot] = gearId;
  if (previous) guild.stash.push(previous);
  refreshStats(adv);
  adv.hp = Math.min(adv.hp, adv.maxHp);
  return null;
}

export function unequip(guild, adv, slot) {
  const current = adv.equipment[slot];
  if (!current) return 'Nothing there.';
  adv.equipment[slot] = null;
  guild.stash.push(current);
  refreshStats(adv);
  return null;
}

export function sellGear(guild, gearId) {
  const i = guild.stash.indexOf(gearId);
  if (i < 0) return 'Not in the stash.';
  guild.stash.splice(i, 1);
  const gear = GEAR_BY_ID[gearId];
  guild.gold += Math.round((GRADE_VALUE[gear.grade] || 20) * 0.6);
  return null;
}

/** Folds an expedition's results back into the guild. */
export function applyResults(guild, results, rng) {
  guild.runs += 1;
  guild.gold += results.gold;
  guild.deepest = Math.max(guild.deepest, results.depth);
  if (results.bossSlain) {
    guild.wins += 1;
    guild.bossKills += 1;
  }
  for (const gearId of results.gear) guild.stash.push(gearId);

  for (const adv of results.dead) {
    guild.fallen.push({
      name: adv.name,
      classId: adv.classId,
      level: adv.level,
      expeditions: adv.expeditions,
      kills: adv.kills + adv.runKills,
      depth: adv.deathRoom ? adv.deathRoom.depth : 0,
      room: adv.deathRoom ? adv.deathRoom.name : 'the dark',
    });
    dismiss(guild, adv.id);
  }

  for (const adv of results.survivors) {
    adv.kills += adv.runKills;
    adv.runKills = 0;
    // Three expeditions in and the guild stops calling you new.
    if (adv.expeditions >= 3 && !adv.traits.includes('veteran')) {
      adv.traits.push('veteran');
      refreshStats(adv);
      guild.story.push(`${adv.name} came back from a third expedition. The guild calls them a veteran now.`);
    }
    adv.hp = adv.maxHp;
    refreshStats(adv);
  }

  guild.story.push(summariseRun(results));
  if (guild.story.length > 40) guild.story.shift();

  // Backfill the roster so the player is never stuck with nobody.
  while (guild.roster.length < PARTY_LIMIT && guild.gold >= 0) {
    const adv = createAdventurer(rng, {
      classId: rng.pick(guild.classes),
      level: guild.startingLevel || 1,
    });
    adv.hire = 'Turned up at the door the morning after. Word travels.';
    guild.roster.push(adv);
  }
  guild.party = guild.roster.slice(0, PARTY_LIMIT).map((a) => a.id);
  return guild;
}

export function summariseRun(results) {
  const parts = [];
  if (results.outcome === 'victory') parts.push('Cindervex is dead');
  else if (results.outcome === 'wiped') parts.push('Nobody came back');
  else parts.push(`Out with ${results.gold} gold`);
  parts.push(`${results.depth} rooms deep`);
  parts.push(`${results.kills} killed`);
  if (results.biomes.length) parts.push(results.biomes.join(' & '));
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function saveGuild(guild) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(guild));
    return true;
  } catch {
    return false;
  }
}

export function loadGuild() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const guild = JSON.parse(raw);
    if (!guild || guild.version !== 2) return null;
    // Re-derive stats: saved numbers may predate a balance change.
    for (const adv of guild.roster) refreshStats(adv);
    guild.deck = (guild.deck || []).filter((id) => CARD_BY_ID[id]);
    guild.stash = (guild.stash || []).filter((id) => GEAR_BY_ID[id]);
    return guild;
  } catch {
    return null;
  }
}

export function wipeSave() {
  const store = storage();
  if (store) {
    try {
      store.removeItem(SAVE_KEY);
    } catch {
      /* nothing to do */
    }
  }
}

export { TRAITS, GRADE_ORDER, CARD_BY_ID };
