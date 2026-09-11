import { assert, atLeast, equal, group, test } from './harness.js';
import { Expedition } from '../src/systems/expedition.js';
import { createAdventurer } from '../src/systems/actors.js';
import { choosePartyObjective, scoreObjectives, updateAdventurer } from '../src/systems/ai.js';
import { RNG } from '../src/core/rng.js';
import { STARTER_CARDS } from '../src/data/cards.js';
import { roomCenter } from '../src/systems/grid.js';

function worldWith(traitsPerClass) {
  const rng = new RNG(77);
  const roster = traitsPerClass.map(([classId, traits]) => createAdventurer(rng, { classId, traits }));
  return new Expedition({ rng, roster, deckCards: STARTER_CARDS.slice(), guild: {} });
}

/** Builds a straight corridor of rooms north of the entrance. */
function corridor(exp, cards) {
  const placed = [];
  cards.forEach((cardId, i) => {
    const room = exp.dungeon.place(cardId, 0, -(i + 1), 0);
    if (room) placed.push(room);
  });
  exp.graphVersion += 1;
  return placed;
}

function scoreOf(scores, roomKey) {
  const entry = scores.find((s) => s.room.key === roomKey);
  return entry ? entry.value : -Infinity;
}

group('ai: what is worth walking to', () => {
  test('an unexplored room is always worth something', () => {
    const exp = worldWith([['fighter', []]]);
    corridor(exp, ['stone_hall']);
    const scores = scoreObjectives(exp.party[0], exp);
    atLeast(scores.length, 1);
    assert(scoreOf(scores, '0,-1') > 0);
  });

  test('distance is a cost, so the near door wins', () => {
    const exp = worldWith([['fighter', []]]);
    corridor(exp, ['stone_hall', 'stone_hall', 'stone_hall']);
    const scores = scoreObjectives(exp.party[0], exp);
    assert(scoreOf(scores, '0,-1') > scoreOf(scores, '0,-3'));
  });

  test('a greedy adventurer values a chest more than a careful one does', () => {
    const build = (traits) => {
      const exp = worldWith([['rogue', traits]]);
      const [room] = corridor(exp, ['stone_hall']);
      room.entered = true;
      room.spawned = true;
      room.loot = { gold: 100, taken: false, x: roomCenter(0, -1).x, y: roomCenter(0, -1).y, name: 'a chest' };
      return scoreOf(scoreObjectives(exp.party[0], exp), '0,-1');
    };
    assert(build(['greedy']) > build(['cautious']), 'greed carries a premium');
  });

  test('a superstitious adventurer discounts a crypt', () => {
    const build = (traits) => {
      const exp = worldWith([['cleric', traits]]);
      corridor(exp, ['crypt']);
      return scoreOf(scoreObjectives(exp.party[0], exp), '0,-1');
    };
    assert(build(['superstitious']) < build([]), 'they would rather not');
  });

  test('a claustrophobic adventurer discounts depth', () => {
    const build = (traits) => {
      const exp = worldWith([['rogue', traits]]);
      corridor(exp, ['stone_hall', 'stone_hall', 'stone_hall']);
      return scoreOf(scoreObjectives(exp.party[0], exp), '0,-3');
    };
    assert(build(['claustrophobic']) < build([]), 'they are counting the rooms back');
  });

  test('a scout is keener on the unknown than anyone else', () => {
    const build = (classId) => {
      const exp = worldWith([[classId, []]]);
      corridor(exp, ['stone_hall']);
      return scoreOf(scoreObjectives(exp.party[0], exp), '0,-1');
    };
    assert(build('rogue') > build('fighter'));
  });

  test('a room with nothing left in it is not an objective', () => {
    const exp = worldWith([['fighter', []]]);
    const [room] = corridor(exp, ['stone_hall']);
    room.entered = true;
    room.spawned = true;
    room.cleared = true;
    equal(scoreObjectives(exp.party[0], exp).length, 0);
  });

  test('the party agrees on one objective between them', () => {
    const exp = worldWith([['fighter', []], ['rogue', []], ['mage', []], ['cleric', []]]);
    corridor(exp, ['stone_hall', 'crypt']);
    const objective = choosePartyObjective(exp);
    assert(objective, 'somewhere to go');
    assert(exp.dungeon.rooms.has(objective));
  });
});

group('ai: nerve', () => {
  test('a badly hurt adventurer turns round and leaves', () => {
    const exp = worldWith([['rogue', ['coward']], ['fighter', []]]);
    const [room] = corridor(exp, ['monster_den']);
    const adv = exp.party[0];
    adv.roomKey = room.key;
    adv.cell = { x: room.x, y: room.y };
    const c = roomCenter(room.x, room.y);
    adv.x = c.x;
    adv.y = c.y;
    exp.onAdventurerEnteredRoom(adv, room);
    assert(exp.enemies.length > 0, 'there is something to be afraid of');
    adv.hp = adv.maxHp * 0.05;
    updateAdventurer(adv, exp, 0.033);
    equal(adv.fleeing, true);
  });

  test('a reckless adventurer holds on much longer than a coward', () => {
    const exp = worldWith([['fighter', ['coward']], ['fighter', ['reckless']]]);
    const [coward, reckless] = exp.party;
    assert(coward.fleeThreshold > reckless.fleeThreshold);
  });

  test('nobody flees a room with nothing in it', () => {
    const exp = worldWith([['mage', ['coward']]]);
    const adv = exp.party[0];
    adv.hp = 1;
    updateAdventurer(adv, exp, 0.033);
    equal(!!adv.fleeing, false);
  });
});

group('ai: one chest, one pair of hands', () => {
  test('two adventurers do not both stand on the same chest', () => {
    const exp = worldWith([['rogue', []], ['fighter', []]]);
    const [room] = corridor(exp, ['stone_hall']);
    room.entered = true;
    room.spawned = true;
    const c = roomCenter(room.x, room.y);
    room.loot = { gold: 50, taken: false, x: c.x, y: c.y, name: 'a chest' };
    for (const adv of exp.party) {
      adv.roomKey = room.key;
      adv.cell = { x: room.x, y: room.y };
      adv.x = c.x;
      adv.y = c.y;
    }
    for (let i = 0; i < 20; i++) for (const adv of exp.party) updateAdventurer(adv, exp, 0.05);
    equal(room.loot.claimedBy, exp.party[0].id, 'the first one there called it');
    const workers = exp.party.filter((a) => a.state === 'interacting');
    assert(workers.length <= 1, 'only one of them works the chest');
  });

  test('loot eventually gets taken and turns into carried gold', () => {
    const exp = worldWith([['rogue', []]]);
    const [room] = corridor(exp, ['stone_hall']);
    room.entered = true;
    room.spawned = true;
    const c = roomCenter(room.x, room.y);
    room.loot = { gold: 50, taken: false, x: c.x, y: c.y, name: 'a chest', grade: 'common' };
    const adv = exp.party[0];
    adv.roomKey = room.key;
    adv.cell = { x: room.x, y: room.y };
    adv.x = c.x;
    adv.y = c.y;
    for (let i = 0; i < 120; i++) updateAdventurer(adv, exp, 0.05);
    equal(room.loot.taken, true);
    atLeast(adv.carriedGold, 1);
  });
});
