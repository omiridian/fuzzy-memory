import { assert, atLeast, equal, group, test } from './harness.js';
import { Dungeon } from '../src/systems/dungeon.js';
import { detectBiomes } from '../src/systems/biomes.js';
import { Deck } from '../src/systems/deck.js';
import { Threat, bandFor } from '../src/systems/threat.js';
import { Chronicle } from '../src/systems/log.js';
import { RNG } from '../src/core/rng.js';
import { ALL_DOORS, DOOR_S, STARTER_CARDS, getCard } from '../src/data/cards.js';
import { key } from '../src/systems/grid.js';

function dungeonWith(seed = 1) {
  return new Dungeon(new RNG(seed));
}

/** Builds a bare room map for the biome matcher, all doors open. */
function biomeMap(cells) {
  const rooms = new Map();
  for (const [x, y, cardId] of cells) {
    rooms.set(key(x, y), { x, y, card: cardId, doors: ALL_DOORS, tags: getCard(cardId).tags });
  }
  return rooms;
}

group('dungeon: placing rooms', () => {
  test('an expedition starts with an entrance and nothing else', () => {
    const d = dungeonWith();
    equal(d.rooms.size, 1);
    const entrance = d.get(0, 0);
    assert(entrance.isEntrance && entrance.entered && entrance.cleared);
  });

  test('a legal card lands and joins the graph', () => {
    const d = dungeonWith();
    const room = d.place('crypt', 0, -1, 0);
    assert(room, 'it went down');
    equal(room.depth, 1);
    equal(room.reachable, true);
    equal(d.rooms.size, 2);
  });

  test('an illegal card is refused and changes nothing', () => {
    const d = dungeonWith();
    equal(d.place('forge', 5, 5, 0), null);
    equal(d.rooms.size, 1);
  });

  test('rotation is applied when the card is placed', () => {
    const d = dungeonWith();
    const room = d.place('torchlit_corridor', 0, -1, 2);
    assert(room, 'rotated so its doors reach the entrance');
    assert((room.doors & DOOR_S) !== 0);
  });

  test('contents stay secret until somebody walks in', () => {
    const d = dungeonWith(4);
    const room = d.place('crypt', 0, -1, 0);
    equal(room.entered, false);
    equal(room.spawned, false);
    equal(room.loot, null);
    const plan = d.reveal(room, { threat: 0 });
    assert(plan.spawns.length > 0, 'the crypt was occupied all along');
    equal(d.reveal(room, { threat: 0 }), null, 'a room is only revealed once');
  });

  test('Threat and depth make a room worse', () => {
    const calm = dungeonWith(7);
    const calmRoom = calm.place('monster_den', 0, -1, 0);
    const calmPlan = calm.reveal(calmRoom, { threat: 0 });
    const roused = dungeonWith(7);
    let deep = roused.place('monster_den', 0, -1, 0);
    for (let i = 2; i < 8; i++) {
      const next = roused.place('stone_hall', 0, -i, 0);
      if (next) deep = next;
    }
    const deepPlan = roused.reveal(deep, { threat: 90 });
    atLeast(deepPlan.spawns.length, calmPlan.spawns.length);
  });

  test('depth is recomputed as the dungeon grows', () => {
    const d = dungeonWith(2);
    d.place('stone_hall', 0, -1, 0);
    d.place('stone_hall', 0, -2, 0);
    equal(d.get(0, -2).depth, 2);
  });

  test('a room is cleared once nothing hostile and nothing loose is left', () => {
    const d = dungeonWith(3);
    const room = d.place('crypt', 0, -1, 0);
    room.entered = true;
    d.reveal(room, { threat: 0 });
    room.enemyIds = ['foe_1'];
    equal(d.updateCleared(room), false);
    room.enemyIds = [];
    room.features.forEach((f) => { f.used = true; });
    if (room.loot) room.loot.taken = true;
    equal(d.updateCleared(room), true);
  });
});

group('dungeon: biomes form from what is next to what', () => {
  test('two crypts and a shrine make a Corrupted Necropolis', () => {
    const found = detectBiomes(biomeMap([[0, 0, 'crypt'], [1, 0, 'crypt'], [2, 0, 'shrine']]));
    equal(found.get('0,0'), 'necropolis');
    equal(found.size, 3);
  });

  test('a forge beside a lava chamber makes an Infernal Forge', () => {
    const found = detectBiomes(biomeMap([[0, 0, 'forge'], [1, 0, 'lava_chamber']]));
    equal(found.get('1,0'), 'infernal_forge');
  });

  test('a mushroom cave beside a lake makes Fungal Wetlands', () => {
    const found = detectBiomes(biomeMap([[0, 0, 'mushroom_cave'], [1, 0, 'underground_lake']]));
    equal(found.get('0,0'), 'fungal_wetlands');
  });

  test('three goblin rooms in a row make a Warren', () => {
    const found = detectBiomes(biomeMap([[0, 0, 'guard_post'], [1, 0, 'monster_den'], [2, 0, 'guard_post']]));
    equal(found.get('1,0'), 'warren');
  });

  test('the same rooms with no doors between them make nothing', () => {
    const rooms = biomeMap([[0, 0, 'crypt'], [1, 0, 'crypt'], [2, 0, 'shrine']]);
    for (const room of rooms.values()) room.doors = 0;
    equal(detectBiomes(rooms).size, 0);
  });

  test('two crypts alone are just two crypts', () => {
    equal(detectBiomes(biomeMap([[0, 0, 'crypt'], [1, 0, 'crypt']])).size, 0);
  });

  test('a new biome is announced exactly once', () => {
    const d = dungeonWith(5);
    assert(d.place('crypt', 0, -1, 0), 'first crypt');
    assert(d.place('crypt', 0, -2, 0), 'second crypt');
    // The shrine's doors are south and west; unrotated, its south door meets
    // the crypt's north one.
    assert(d.place('shrine', 0, -3, 0), 'shrine on the end');
    const fresh = d.takeNewBiomes();
    equal(fresh.length, 1);
    equal(fresh[0].id, 'necropolis');
    equal(d.takeNewBiomes().length, 0);
  });
});

group('deck: the hand', () => {
  test('a hand fills to five and no further', () => {
    const deck = new Deck(STARTER_CARDS.slice(), new RNG(1));
    deck.fill();
    equal(deck.hand.length, 5);
    equal(deck.drawOne(), null);
  });

  test('rotating a card changes its doors', () => {
    const deck = new Deck(['torchlit_corridor'], new RNG(1));
    const entry = deck.drawOne();
    const before = deck.doorsOf(entry);
    deck.rotate(entry.uid);
    assert(deck.doorsOf(entry) !== before);
  });

  test('building a card moves it to the discard', () => {
    const deck = new Deck(STARTER_CARDS.slice(), new RNG(2));
    deck.fill();
    const entry = deck.hand[0];
    deck.consume(entry.uid);
    equal(deck.hand.length, 4);
    equal(deck.discard.length, 1);
    equal(deck.placedCount, 1);
  });

  test('throwing a card back swaps it for a new one', () => {
    const deck = new Deck(STARTER_CARDS.slice(), new RNG(3));
    deck.fill();
    const entry = deck.hand[0];
    const result = deck.mulligan(entry.uid);
    equal(deck.hand.length, 5);
    assert(result.replacement, 'a replacement arrives');
    assert(!deck.find(entry.uid), 'the old one is gone');
  });

  test('an empty draw pile reshuffles the discard', () => {
    const deck = new Deck(['stone_hall', 'crossroads'], new RNG(4));
    deck.fill();
    deck.consume(deck.hand[0].uid);
    deck.consume(deck.hand[0].uid);
    equal(deck.remaining, 0);
    assert(deck.drawOne(), 'the discard comes back round');
  });

  test('a free card arrives on a timer', () => {
    const deck = new Deck(STARTER_CARDS.slice(), new RNG(5));
    deck.drawOne();
    equal(deck.tick(1), null);
    assert(deck.tick(99), 'and then one does');
  });

  test('an ordinary card comes round again, a boss vault does not', () => {
    const deck = new Deck(['stone_hall', 'boss_chamber', 'stone_hall'], new RNG(7));
    deck.fill();
    const vault = deck.hand.find((c) => c.id === 'boss_chamber');
    deck.consume(vault.uid);
    equal(deck.uniquesPlaced.has('boss_chamber'), true);
    assert(!deck.discard.includes('boss_chamber'), 'it does not go back in the pile');
    const hall = deck.hand.find((c) => c.id === 'stone_hall');
    deck.consume(hall.uid);
    assert(deck.discard.includes('stone_hall'), 'ordinary rooms recycle');
  });

  test('hand masks cover every rotation available', () => {
    const deck = new Deck(['torchlit_corridor'], new RNG(6));
    deck.drawOne();
    equal(deck.handMasks().length, 4);
  });
});

group('threat: it only goes up', () => {
  test('adding Threat moves the band when it crosses a line', () => {
    const t = new Threat();
    equal(t.add(10, 'a test'), null);
    const crossed = t.add(15, 'another');
    assert(crossed && crossed.name === 'Stirring');
  });

  test('Threat drifts up on its own, faster when you are deep', () => {
    const shallow = new Threat();
    const deep = new Threat();
    shallow.tick(10, { depth: 0 });
    deep.tick(10, { depth: 6 });
    assert(deep.value > shallow.value);
  });

  test('Threat is capped and scales the monsters', () => {
    const t = new Threat();
    t.add(500, 'everything at once');
    equal(t.value, 100);
    assert(t.enemyScale > 1.5);
    equal(bandFor(100).name, 'Furious');
  });
});

group('chronicle', () => {
  test('entries are kept in order and age', () => {
    const c = new Chronicle();
    c.write('first');
    c.write('second', 'good');
    c.tick(2);
    equal(c.entries.length, 2);
    equal(c.recent(1)[0].text, 'second');
    assert(c.entries[0].age >= 2);
  });
});
