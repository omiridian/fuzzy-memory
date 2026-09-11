import { assert, atLeast, equal, group, test } from './harness.js';
import {
  CARD_SHOP, DECK_LIMIT, PARTY_LIMIT, ROSTER_LIMIT, SHOP, UPGRADES,
  addToDeck, applyResults, buy, canBuy, copiesInDeck, dismiss, equip, hire, hireCost,
  newGuild, ownedCopies, removeFromDeck, sellGear, summariseRun,
  togglePartyMember, unequip,
} from '../src/systems/guild.js';
import { RNG } from '../src/core/rng.js';

const rng = () => new RNG(42);

group('guild: opening day', () => {
  test('a new guild has people, cards and a little money', () => {
    const g = newGuild(rng());
    equal(g.roster.length, 4);
    equal(g.party.length, PARTY_LIMIT);
    atLeast(g.deck.length, 10);
    atLeast(g.gold, 1);
    equal(g.fallen.length, 0);
  });

  test('the starting four cover the four roles', () => {
    const g = newGuild(rng());
    const classes = g.roster.map((a) => a.classId).sort();
    equal(classes.join(','), 'cleric,fighter,mage,rogue');
  });
});

group('guild: the roster', () => {
  test('hiring costs gold and adds somebody', () => {
    const g = newGuild(rng());
    g.gold = 5000;
    const cost = hireCost(g);
    equal(hire(g, rng(), 'fighter'), null);
    equal(g.roster.length, 5);
    equal(g.gold, 5000 - cost);
  });

  test('hiring is refused when the money or the room runs out', () => {
    const g = newGuild(rng());
    g.gold = 0;
    assert(hire(g, rng(), 'fighter'));
    g.gold = 99999;
    while (g.roster.length < ROSTER_LIMIT) hire(g, rng(), 'rogue');
    assert(hire(g, rng(), 'rogue'), 'the hall is full');
  });

  test('only four go down at a time', () => {
    const g = newGuild(rng());
    g.gold = 9999;
    hire(g, rng(), 'mage');
    const spare = g.roster[4];
    assert(togglePartyMember(g, spare.id), 'the party is already full');
    togglePartyMember(g, g.party[0]);
    equal(togglePartyMember(g, spare.id), null);
    equal(g.party.length, PARTY_LIMIT);
  });

  test('dismissing somebody takes them off the party too', () => {
    const g = newGuild(rng());
    const victim = g.roster[0];
    dismiss(g, victim.id);
    equal(g.roster.length, 3);
    assert(!g.party.includes(victim.id));
  });

  test('gear moves between the stash and a person, and back', () => {
    const g = newGuild(rng());
    const adv = g.roster.find((a) => a.classId === 'fighter');
    g.stash.push('guild_mail');
    const before = adv.maxHp;
    equal(equip(g, adv, 'guild_mail'), null);
    assert(adv.maxHp > before, 'the mail counts');
    equal(g.stash.length, 0);
    equal(unequip(g, adv, 'armor'), null);
    equal(g.stash[0], 'guild_mail');
    equal(adv.maxHp, before);
  });

  test('a class cannot hold somebody else’s weapon', () => {
    const g = newGuild(rng());
    const mage = g.roster.find((a) => a.classId === 'mage');
    g.stash.push('boarding_axe');
    assert(equip(g, mage, 'boarding_axe'), 'the mage declines');
  });

  test('selling gear turns it into gold', () => {
    const g = newGuild(rng());
    g.stash.push('kingmaker');
    const before = g.gold;
    equal(sellGear(g, 'kingmaker'), null);
    assert(g.gold > before);
    equal(g.stash.length, 0);
  });
});

group('guild: the deck', () => {
  test('a card can only go in the deck as often as you own it', () => {
    const g = newGuild(rng());
    g.deck = [];
    equal(ownedCopies(g, 'crossroads'), 1);
    equal(addToDeck(g, 'crossroads'), null);
    assert(addToDeck(g, 'crossroads'), 'you only own the one');
    equal(copiesInDeck(g, 'crossroads'), 1);
  });

  test('the deck has a ceiling', () => {
    const g = newGuild(rng());
    g.owned.stone_hall = 99;
    g.deck = [];
    for (let i = 0; i < DECK_LIMIT; i++) equal(addToDeck(g, 'stone_hall'), null);
    assert(addToDeck(g, 'stone_hall'), 'full is full');
  });

  test('cards can be taken out again', () => {
    const g = newGuild(rng());
    const before = g.deck.length;
    equal(removeFromDeck(g, 'crossroads'), null);
    equal(g.deck.length, before - 1);
    assert(removeFromDeck(g, 'boss_chamber'), 'it was never in there');
  });
});

group('guild: requisitions', () => {
  test('everything in the shop is priced and described', () => {
    for (const entry of SHOP) {
      atLeast(entry.cost, 1);
      assert(entry.name && entry.blurb, `${entry.id} is written`);
      assert(['card', 'class', 'upgrade'].includes(entry.kind));
    }
  });

  test('you cannot buy what you cannot afford', () => {
    const g = newGuild(rng());
    g.gold = 0;
    assert(canBuy(g, CARD_SHOP[0]));
  });

  test('buying a card adds a copy you can then deck', () => {
    const g = newGuild(rng());
    g.gold = 9999;
    const card = CARD_SHOP.find((c) => c.id === 'treasure_vault');
    equal(buy(g, card), null);
    equal(ownedCopies(g, 'treasure_vault'), 1);
    equal(addToDeck(g, 'treasure_vault'), null);
  });

  test('an upgrade applies itself and cannot be bought twice', () => {
    const g = newGuild(rng());
    g.gold = 9999;
    const upgrade = UPGRADES.find((u) => u.id === 'wide_hand');
    equal(buy(g, upgrade), null);
    equal(g.handSize, 6);
    assert(buy(g, upgrade), 'already bought');
  });

  test('upgrades with prerequisites wait their turn', () => {
    const g = newGuild(rng());
    g.gold = 9999;
    const second = UPGRADES.find((u) => u.id === 'insurance_2');
    assert(canBuy(g, second), 'the first contract comes first');
    buy(g, UPGRADES.find((u) => u.id === 'insurance_1'));
    equal(canBuy(g, second), null);
  });

  test('unlocking a class lets you hire it', () => {
    const g = newGuild(rng());
    g.gold = 9999;
    assert(!g.classes.includes('ranger'));
    equal(buy(g, SHOP.find((s) => s.id === 'ranger')), null);
    assert(g.classes.includes('ranger'));
  });
});

group('guild: what a run leaves behind', () => {
  function fakeResults(guild, overrides = {}) {
    return {
      outcome: 'extracted',
      gold: 300,
      gear: ['guild_mail'],
      survivors: guild.roster.slice(0, 3),
      dead: [],
      depth: 5,
      rooms: 9,
      kills: 12,
      eliteKills: 1,
      threat: 48,
      biomes: ['The Warren'],
      duration: 240,
      bossSlain: false,
      ...overrides,
    };
  }

  test('gold and gear come home, and the ledger gets a line', () => {
    const g = newGuild(rng());
    const before = g.gold;
    applyResults(g, fakeResults(g), rng());
    equal(g.gold, before + 300);
    assert(g.stash.includes('guild_mail'));
    equal(g.runs, 1);
    equal(g.deepest, 5);
    atLeast(g.story.length, 1);
  });

  test('the dead leave the roster and join the wall', () => {
    const g = newGuild(rng());
    const victim = g.roster[0];
    victim.deathRoom = { name: 'Ossuary', depth: 4 };
    applyResults(g, fakeResults(g, { survivors: g.roster.slice(1), dead: [victim] }), rng());
    assert(!g.roster.find((a) => a.id === victim.id), 'gone from the books');
    equal(g.fallen[0].name, victim.name);
    equal(g.fallen[0].room, 'Ossuary');
  });

  test('the roster is topped up so you are never stuck', () => {
    const g = newGuild(rng());
    const all = g.roster.slice();
    for (const adv of all) adv.deathRoom = { name: 'the dark', depth: 2 };
    applyResults(g, fakeResults(g, { outcome: 'wiped', gold: 40, survivors: [], dead: all }), rng());
    atLeast(g.roster.length, PARTY_LIMIT);
    equal(g.fallen.length, 4);
  });

  test('three expeditions makes somebody a veteran', () => {
    const g = newGuild(rng());
    const adv = g.roster[0];
    adv.expeditions = 3;
    applyResults(g, fakeResults(g, { survivors: [adv] }), rng());
    assert(adv.traits.includes('veteran'));
  });

  test('killing the wyrm counts as a win', () => {
    const g = newGuild(rng());
    applyResults(g, fakeResults(g, { outcome: 'victory', bossSlain: true }), rng());
    equal(g.wins, 1);
    equal(g.bossKills, 1);
  });

  test('a run summary reads like a sentence', () => {
    const line = summariseRun({ outcome: 'extracted', gold: 120, depth: 4, kills: 9, biomes: ['The Warren'] });
    assert(line.includes('120') && line.includes('The Warren'));
  });
});

group('guild: a first-time player can reach the headline feature', () => {
  test('the starting deck contains a whole biome recipe', () => {
    const g = newGuild(rng());
    const counts = {};
    for (const id of g.deck) counts[id] = (counts[id] || 0) + 1;
    atLeast(counts.crypt || 0, 2);
    atLeast(counts.shrine || 0, 1);
  });
});
