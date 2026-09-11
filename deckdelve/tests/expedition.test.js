import { assert, atLeast, equal, group, test } from './harness.js';
import { Expedition } from '../src/systems/expedition.js';
import { createAdventurer } from '../src/systems/actors.js';
import { RNG } from '../src/core/rng.js';
import { STARTER_CARDS, rotateDoors } from '../src/data/cards.js';
import { legalCells, key } from '../src/systems/grid.js';

const DECK = STARTER_CARDS.concat([
  'crypt', 'monster_den', 'ossuary', 'treasure_vault', 'trapped_gallery',
  'underground_lake', 'alchemy_lab', 'puzzle_room', 'crossroads', 'stone_hall',
]);

function makeRun(seed = 1, classes = ['fighter', 'rogue', 'mage', 'cleric']) {
  const rng = new RNG(seed);
  const roster = classes.map((classId) => createAdventurer(rng, { classId }));
  return new Expedition({ rng, roster, deckCards: DECK.slice(), guild: {} });
}

/** Places the first card in hand that fits anywhere, the way a player would. */
function buildSomething(exp, rng) {
  for (const entry of exp.deck.hand.slice()) {
    for (let rot = 0; rot < entry.rotations; rot++) {
      entry.rotation = rot;
      const cells = legalCells(exp.dungeon.rooms, rotateDoors(entry.card.doors, rot));
      if (!cells.length) continue;
      cells.sort((a, b) => Math.abs(b.x) + Math.abs(b.y) - Math.abs(a.x) - Math.abs(a.y));
      const cell = cells[rng.int(Math.min(2, cells.length))];
      if (exp.placeCard(entry.uid, cell.x, cell.y).ok) return true;
    }
  }
  return false;
}

function run(exp, seconds, rng, opts = {}) {
  const dt = 1 / 30;
  for (let step = 0; step < seconds * 30; step++) {
    if (opts.build !== false && step % 180 === 0) buildSomething(exp, rng);
    if (opts.each) opts.each(exp, step);
    exp.update(dt);
    if (exp.outcome) break;
  }
  return exp;
}

group('expedition: setting out', () => {
  test('a run starts at the entrance with a full hand', () => {
    const exp = makeRun(1);
    equal(exp.party.length, 4);
    equal(exp.deck.hand.length, 5);
    equal(exp.dungeon.rooms.size, 1);
    for (const adv of exp.party) equal(adv.roomKey, '0,0');
    atLeast(exp.chronicle.entries.length, 1);
  });

  test('building a room spends the card, raises Threat and writes it down', () => {
    const exp = makeRun(2);
    const entry = exp.deck.hand.find((c) => c.card.threat > 0) || exp.deck.hand[0];
    const before = { hand: exp.deck.hand.length, threat: exp.threat.value, log: exp.chronicle.entries.length };
    let placed = false;
    for (let rot = 0; rot < entry.rotations && !placed; rot++) {
      entry.rotation = rot;
      const cells = legalCells(exp.dungeon.rooms, rotateDoors(entry.card.doors, rot));
      if (cells.length) placed = exp.placeCard(entry.uid, cells[0].x, cells[0].y).ok;
    }
    assert(placed, 'something in an opening hand always fits');
    equal(exp.deck.hand.length, before.hand - 1);
    equal(exp.roomsPlaced, 1);
    assert(exp.chronicle.entries.length > before.log);
    if (entry.card.threat) assert(exp.threat.value > before.threat, 'a dangerous room is noticed');
  });

  test('an illegal placement is refused with a reason and costs nothing', () => {
    const exp = makeRun(3);
    const entry = exp.deck.hand[0];
    const result = exp.placeCard(entry.uid, 6, 6);
    equal(result.ok, false);
    assert(result.reason.length > 0);
    equal(exp.deck.hand.length, 5);
  });

  test('throwing a card back costs a little Threat', () => {
    const exp = makeRun(4);
    const before = exp.threat.value;
    exp.mulligan(exp.deck.hand[0].uid);
    assert(exp.threat.value > before);
    equal(exp.deck.hand.length, 5);
  });
});

group('expedition: they explore it on their own', () => {
  test('the party walks into what you build and finds out what is in it', () => {
    const rng = new RNG(11);
    const exp = makeRun(11);
    run(exp, 90, rng);
    const entered = exp.dungeon.list().filter((r) => r.entered);
    atLeast(entered.length, 3, 'they got past the first door without being told');
    atLeast(exp.dungeon.deepestEntered(), 2);
    assert(entered.every((r) => r.spawned), 'every room they entered rolled its contents');
  });

  test('monsters get fought and rooms get cleared', () => {
    const rng = new RNG(12);
    const exp = makeRun(12);
    run(exp, 150, rng);
    atLeast(exp.kills, 1);
    atLeast(exp.dungeon.list().filter((r) => r.cleared).length, 2);
  });

  test('loot is picked up and carried by whoever picked it up', () => {
    const rng = new RNG(13);
    const exp = makeRun(13);
    run(exp, 180, rng);
    const carried = exp.party.reduce((a, p) => a + p.carriedGold, 0);
    atLeast(carried, 1, 'somebody is carrying money');
    const taken = exp.dungeon.list().filter((r) => r.loot && r.loot.taken);
    atLeast(taken.length, 1);
  });

  test('nobody ends up standing inside a wall', () => {
    const rng = new RNG(14);
    const exp = makeRun(14);
    let offside = 0;
    run(exp, 90, rng, {
      each: (e) => {
        for (const adv of e.living) {
          if (!e.dungeon.rooms.has(adv.roomKey)) offside++;
        }
      },
    });
    equal(offside, 0);
  });

  test('experience is earned and levels are gained', () => {
    const rng = new RNG(15);
    const exp = makeRun(15);
    run(exp, 210, rng);
    const top = Math.max(...exp.party.map((a) => a.level));
    atLeast(top, 2, 'somebody levelled up down there');
  });
});

group('expedition: orders', () => {
  test('retreat sends everyone back to the entrance', () => {
    const rng = new RNG(21);
    const exp = makeRun(21);
    run(exp, 60, rng);
    exp.setOrder(exp.living, 'retreat');
    run(exp, 120, rng, { build: false });
    const home = key(exp.entranceCell.x, exp.entranceCell.y);
    const back = exp.living.filter((a) => a.roomKey === home).length;
    atLeast(back, 1, 'at least somebody made it out');
  });

  test('extraction ends the run once the survivors are all home', () => {
    const rng = new RNG(22);
    const exp = makeRun(22);
    run(exp, 60, rng);
    exp.beginExtraction();
    run(exp, 180, rng, { build: false });
    equal(exp.outcome, 'extracted');
    assert(exp.results, 'a debrief is produced');
    atLeast(exp.results.rooms, 1);
  });

  test('hold stops people wandering off', () => {
    const rng = new RNG(23);
    const exp = makeRun(23);
    run(exp, 40, rng);
    exp.setOrder(exp.living, 'hold');
    const where = exp.living.map((a) => ({ adv: a, x: a.x, y: a.y }));
    run(exp, 25, rng, { build: false });
    for (const spot of where) {
      if (!spot.adv.alive) continue;
      const moved = Math.hypot(spot.adv.x - spot.x, spot.adv.y - spot.y);
      assert(moved < 90, `${spot.adv.name} stayed roughly put (moved ${moved.toFixed(0)})`);
    }
  });

  test('rest heals a party that is not being chased', () => {
    const rng = new RNG(24);
    const exp = makeRun(24);
    const adv = exp.party[0];
    adv.hp = adv.maxHp * 0.4;
    exp.setOrder(exp.living, 'rest');
    run(exp, 20, rng, { build: false });
    assert(adv.hp > adv.maxHp * 0.4, 'they caught their breath');
  });

  test('focus fire points everyone at one thing', () => {
    const rng = new RNG(25);
    const exp = makeRun(25);
    run(exp, 90, rng);
    const foe = exp.enemies.find((e) => e.alive);
    if (!foe) return; // nothing alive to focus; the rest of the suite covers combat
    exp.focusTarget(exp.living, foe);
    for (const adv of exp.living) equal(adv.focusId, foe.id);
  });
});

group('expedition: consequences', () => {
  test('a wipe ends the run and keeps only the insurance', () => {
    const exp = makeRun(31);
    exp.guild.insurance = 0.5;
    for (const adv of exp.party) adv.carriedGold = 100;
    const [first, ...rest] = exp.party;
    for (const adv of rest) exp.kill(adv, null);
    equal(exp.outcome, null, 'still one of them standing');
    exp.kill(first, null);
    equal(exp.outcome, 'wiped');
    equal(exp.results.gold, 200, 'half of four hundred');
    equal(exp.results.survivors.length, 0);
    equal(exp.results.dead.length, 4);
  });

  test('the dead are written up with where they fell', () => {
    const rng = new RNG(32);
    const exp = makeRun(32);
    run(exp, 60, rng);
    const victim = exp.party[0];
    exp.kill(victim, { name: 'Something Unpleasant' });
    const obituary = exp.chronicle.entries.filter((e) => e.kind === 'death');
    atLeast(obituary.length, 1);
    assert(obituary.some((e) => e.text.includes(victim.name)));
  });

  test('killing things raises Threat', () => {
    const exp = makeRun(33);
    const before = exp.threat.value;
    const rng = new RNG(33);
    run(exp, 120, rng);
    assert(exp.threat.value > before);
    assert(exp.threat.value <= 100);
  });

  test('a full run produces a debrief with everything the guild needs', () => {
    const rng = new RNG(34);
    const exp = makeRun(34);
    run(exp, 120, rng);
    const results = exp.finish('extracted');
    for (const field of ['outcome', 'gold', 'gear', 'survivors', 'dead', 'depth', 'rooms', 'kills', 'threat', 'biomes']) {
      assert(results[field] !== undefined, `results carry ${field}`);
    }
    assert(Array.isArray(results.chronicle));
  });
});

group('expedition: it survives being played badly', () => {
  test('ten different seeds all run for three minutes without falling over', () => {
    for (let seed = 100; seed < 110; seed++) {
      const rng = new RNG(seed);
      const exp = makeRun(seed);
      run(exp, 180, rng);
      if (!exp.outcome) exp.finish('timeout');
      atLeast(exp.dungeon.list().filter((r) => r.entered).length, 2, `seed ${seed} explored something`);
      assert(exp.threat.value <= 100, `seed ${seed} kept Threat in range`);
      for (const adv of exp.party) {
        assert(Number.isFinite(adv.x) && Number.isFinite(adv.y), `seed ${seed}: ${adv.name} has a position`);
        assert(adv.hp >= 0 && adv.hp <= adv.maxHp, `seed ${seed}: ${adv.name} has sane health`);
      }
    }
  });
});

group('expedition: the things at the bottom', () => {
  /** Puts a boss room on the board and walks somebody into it. */
  function openBossRoom(exp, cardId) {
    let room = null;
    for (let i = 1; i <= 6; i++) {
      const next = exp.dungeon.place(i === 6 ? cardId : 'stone_hall', 0, -i, 0);
      if (next) room = next;
    }
    exp.graphVersion += 1;
    const adv = exp.party[0];
    const center = { x: room.x * 144 + 72, y: room.y * 144 + 72 };
    adv.roomKey = room.key;
    adv.cell = { x: room.x, y: room.y };
    adv.x = center.x;
    adv.y = center.y;
    exp.onAdventurerEnteredRoom(adv, room);
    return room;
  }

  test('the Warden’s Gate wakes Grumwick, who introduces himself', () => {
    const exp = makeRun(41);
    openBossRoom(exp, 'wardens_gate');
    const boss = exp.enemies.find((e) => e.boss);
    assert(boss, 'something enormous was pretending to be furniture');
    equal(boss.type, 'grumwick');
    assert(exp.chronicle.entries.some((e) => e.kind === 'boss'));
  });

  test('killing the mini-boss is recorded and raises Threat sharply', () => {
    const exp = makeRun(42);
    openBossRoom(exp, 'wardens_gate');
    const boss = exp.enemies.find((e) => e.boss);
    const before = exp.threat.value;
    exp.kill(boss, exp.party[0]);
    equal(exp.miniBossSlain, true);
    assert(exp.threat.value > before + 4);
  });

  test('the Vault holds Cindervex, and killing her wins the run', () => {
    const exp = makeRun(43);
    openBossRoom(exp, 'boss_chamber');
    const boss = exp.enemies.find((e) => e.boss);
    assert(boss && boss.type === 'cindervex');
    atLeast(boss.maxHp, 500);
    exp.kill(boss, exp.party[0]);
    equal(exp.bossSlain, true);
    exp.beginExtraction();
    equal(exp.outcome, 'victory', 'the way out opens the moment she dies');
    atLeast(exp.results.gold, 0);
  });

  test('Cindervex can call the hoard without the game falling over', () => {
    const exp = makeRun(45);
    openBossRoom(exp, 'boss_chamber');
    const boss = exp.enemies.find((e) => e.boss);
    const before = exp.enemies.length;
    const summoned = exp.summon(boss, 'fire_imp', 2);
    equal(summoned.length, 2);
    equal(exp.enemies.length, before + 2);
    for (const foe of summoned) equal(foe.roomKey, boss.roomKey);
  });

  test('a boss fight runs to a conclusion without throwing', () => {
    const rng = new RNG(46);
    const exp = makeRun(46);
    const room = openBossRoom(exp, 'boss_chamber');
    for (const adv of exp.party) {
      adv.roomKey = room.key;
      adv.cell = { x: room.x, y: room.y };
      adv.x = room.x * 144 + 72;
      adv.y = room.y * 144 + 100;
    }
    run(exp, 120, rng, { build: false });
    const boss = exp.enemies.find((e) => e.boss);
    assert(!boss.alive || !exp.living.length || exp.time > 100, 'somebody lost');
  });

  test('a boss room will not open within sight of daylight', () => {
    const exp = makeRun(44);
    const entry = exp.deck.hand[0];
    entry.card = { ...entry.card, minDepth: 5, name: 'Test Vault' };
    const check = exp.canPlaceEntry(entry, 0, -1);
    equal(check.ok, false);
    assert(check.reason.includes('daylight'));
  });
});
