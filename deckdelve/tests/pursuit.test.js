// Guards against the exploit a player found: a party of mages walking the whole
// dungeon untouched, because monsters could not leave their rooms and could not
// notice anything standing beyond their aggro radius.

import { assert, atLeast, equal, group, test } from './harness.js';
import { Expedition } from '../src/systems/expedition.js';
import { createAdventurer, createEnemy } from '../src/systems/actors.js';
import { RNG } from '../src/core/rng.js';
import { STARTER_CARDS, rotateDoors } from '../src/data/cards.js';
import { doorPoint, legalCells, roomCenter } from '../src/systems/grid.js';
import { withinLeash } from '../src/systems/ai.js';

/** An expedition with one corridor north of the entrance and nothing else. */
function corridorWorld(classes, seed = 3) {
  const rng = new RNG(seed);
  const roster = classes.map((classId) => createAdventurer(rng, { classId, traits: [] }));
  const exp = new Expedition({ rng, roster, deckCards: STARTER_CARDS.slice(), guild: {} });
  const room = exp.dungeon.place('stone_hall', 0, -1, 0);
  room.entered = true;
  room.spawned = true;
  exp.graphVersion += 1;
  return { exp, room };
}

function place(actor, x, y, roomKey) {
  actor.x = x;
  actor.y = y;
  actor.roomKey = roomKey;
  const [gx, gy] = roomKey.split(',').map(Number);
  actor.cell = { x: gx, y: gy };
}

/**
 * Runs the clock and totals the damage the party actually took. Comparing
 * health before and after does not work: out-of-combat regeneration quietly
 * heals a short fight back to full, which is how the first version of these
 * tests managed to report a party taking no damage at all.
 */
function simulate(exp, seconds) {
  const dt = 1 / 30;
  let taken = 0;
  let homecomings = 0;
  const away = new Set();
  for (let i = 0; i < seconds * 30; i++) {
    const before = exp.party.reduce((a, p) => a + (p.alive ? p.hp : 0), 0);
    exp.update(dt);
    const after = exp.party.reduce((a, p) => a + (p.alive ? p.hp : 0), 0);
    if (after < before) taken += before - after;
    for (const foe of exp.enemies) {
      if (!foe.alive) continue;
      const home = foe.homeKey || foe.roomKey;
      if (foe.roomKey !== home) away.add(foe.id);
      else if (away.delete(foe.id)) homecomings += 1;
    }
    if (exp.outcome) break;
  }
  return { taken, homecomings };
}

group('pursuit: nothing is a free kill from the next room', () => {
  test('a caster in the doorway cannot shoot something across the room beyond', () => {
    const { exp, room } = corridorWorld(['mage']);
    const mage = exp.party[0];
    // The mage stands in the entrance's northern doorway; the monster sits in
    // the middle of the room beyond, where it spawned.
    const gap = doorPoint(0, 0, 0);
    place(mage, gap.x, gap.y - 4, '0,0');
    const centre = roomCenter(room.x, room.y);
    const foe = createEnemy('myconid_thrall', centre.x, centre.y, room.key, {});
    exp.addEnemy(foe, room);

    equal(exp.canEngage(mage, foe), false, 'half a room away is not a doorway');
    equal(exp.canEngage(foe, mage), false, 'and the rule reads the same both ways');
  });

  test('standing near a doorway is not the same as standing in it', () => {
    const { exp, room } = corridorWorld(['mage']);
    const mage = exp.party[0];
    const gap = doorPoint(0, 0, 0);
    // Thirty-four pixels back on each side: close to the door, not in it, and
    // sixty-eight pixels apart through a stone wall. This is the gap the old
    // rule left open, and the one a mage used to shoot through with impunity.
    place(mage, gap.x, gap.y + 34, '0,0');
    const foe = createEnemy('skeleton_warrior', gap.x, gap.y - 34, room.key, {});
    exp.addEnemy(foe, room);

    const apart = Math.hypot(mage.x - foe.x, mage.y - foe.y);
    atLeast(apart, 60, 'they really are a wall apart');
    assert(apart > foe.attackRange, 'and far outside anything the monster could swing at');
    equal(exp.canEngage(mage, foe), false, 'so neither of them can touch the other');
  });

  test('engagement through a doorway is mutual and within a monster’s reach', () => {
    const { exp, room } = corridorWorld(['mage']);
    const mage = exp.party[0];
    const gap = doorPoint(0, 0, 0);
    place(mage, gap.x, gap.y - 6, '0,0');
    const foe = createEnemy('skeleton_warrior', gap.x, gap.y + 12, room.key, {});
    exp.addEnemy(foe, room);

    equal(exp.canEngage(mage, foe), true, 'both are standing in the gap');
    equal(exp.canEngage(foe, mage), true);
    const apart = Math.hypot(mage.x - foe.x, mage.y - foe.y);
    atLeast(foe.attackRange + 4, apart, 'a monster in the doorway can actually swing back');
  });

  test('a mage cannot farm a room it is not standing in', () => {
    const { exp, room } = corridorWorld(['mage']);
    const mage = exp.party[0];
    mage.order = 'hold';
    const gap = doorPoint(0, 0, 0);
    place(mage, gap.x, gap.y - 10, '0,0');
    mage.orderPoint = { x: mage.x, y: mage.y };
    const centre = roomCenter(room.x, room.y);
    const foe = createEnemy('myconid_thrall', centre.x, centre.y, room.key, {});
    exp.addEnemy(foe, room);
    const foeHp = foe.hp;

    const { taken } = simulate(exp, 25);

    // Either nothing happened, or it was a real fight — never one-sided.
    if (foe.hp < foeHp) {
      atLeast(taken, 1, 'a monster that took damage got to answer for it');
    }
  });
});

group('pursuit: being shot is being noticed', () => {
  test('a monster whose aggro is outranged still turns on whoever shot it', () => {
    const rng = new RNG(9);
    const roster = [createAdventurer(rng, { classId: 'mage', traits: [] })];
    const exp = new Expedition({ rng, roster, deckCards: STARTER_CARDS.slice(), guild: {} });
    const room = exp.dungeon.get(0, 0);
    const centre = roomCenter(0, 0);
    const mage = exp.party[0];
    place(mage, centre.x - 50, centre.y, '0,0');
    // Aggro 100, well inside the mage's 128 reach — it should never see it coming.
    const foe = createEnemy('myconid_thrall', centre.x + 50, centre.y, room.key, {});
    assert(foe.aggro < mage.attackRange, 'the setup is the one the player found');
    exp.addEnemy(foe, room);
    room.spawned = true;

    equal(foe.targetId, null);
    exp.provoke(foe, mage);
    equal(foe.targetId, mage.id, 'a hit is a introduction');
  });

  test('damage provokes through the normal combat path', () => {
    const rng = new RNG(10);
    const roster = [createAdventurer(rng, { classId: 'mage', traits: [] })];
    const exp = new Expedition({ rng, roster, deckCards: STARTER_CARDS.slice(), guild: {} });
    const room = exp.dungeon.get(0, 0);
    const mage = exp.party[0];
    // Diagonally across one room: inside the mage's 128 reach, outside the
    // myconid's 100 of notice. Nothing but being shot can start this fight.
    place(mage, 28, 28, '0,0');
    mage.order = 'hold';
    mage.orderPoint = { x: mage.x, y: mage.y };
    const foe = createEnemy('myconid_thrall', 116, 116, room.key, {});
    exp.addEnemy(foe, room);
    room.spawned = true;

    const apart = Math.hypot(mage.x - foe.x, mage.y - foe.y);
    assert(apart <= mage.attackRange, `the mage can reach it (${apart.toFixed(0)}px)`);
    assert(apart > foe.aggro, `the myconid cannot see that far (${apart.toFixed(0)}px vs ${foe.aggro})`);

    const { taken } = simulate(exp, 30);
    assert(!foe.alive || foe.hp < foe.maxHp, 'the mage got shots off');
    atLeast(taken, 1, 'and the myconid noticed being shot and came over');
  });

  test('a stray hit does not pull a monster off the ally it is already fighting', () => {
    const { exp, room } = corridorWorld(['fighter', 'mage']);
    const [fighter, mage] = exp.party;
    const centre = roomCenter(room.x, room.y);
    const foe = createEnemy('ghoul', centre.x, centre.y, room.key, {});
    exp.addEnemy(foe, room);
    place(fighter, centre.x - 20, centre.y, room.key);
    place(mage, centre.x + 60, centre.y, room.key);
    foe.targetId = fighter.id;
    exp.provoke(foe, mage);
    equal(foe.targetId, fighter.id, 'it keeps its hands full');
  });
});

group('pursuit: monsters follow, but not forever', () => {
  test('a monster will leave its room to chase somebody next door', () => {
    const { exp, room } = corridorWorld(['rogue']);
    const rogue = exp.party[0];
    const centre = roomCenter(room.x, room.y);
    const foe = createEnemy('goblin_skirmisher', centre.x, centre.y, room.key, {});
    exp.addEnemy(foe, room);
    place(rogue, roomCenter(0, 0).x, roomCenter(0, 0).y, '0,0');
    foe.targetId = rogue.id;
    rogue.order = 'hold';
    rogue.orderPoint = { x: rogue.x, y: rogue.y };

    equal(foe.roomKey, room.key);
    simulate(exp, 12);
    assert(foe.roomKey === '0,0' || rogue.hp < rogue.maxHp, 'it came through the door');
  });

  test('the leash stops a monster crossing the whole dungeon', () => {
    const { exp } = corridorWorld(['rogue']);
    exp.dungeon.place('stone_hall', 0, -2, 0);
    exp.dungeon.place('stone_hall', 0, -3, 0);
    exp.graphVersion += 1;
    const foe = createEnemy('goblin_skirmisher', 0, 0, '0,0', {});
    equal(withinLeash(exp, foe, '0,0'), true, 'its own room');
    equal(withinLeash(exp, foe, '0,-1'), true, 'and next door');
    equal(withinLeash(exp, foe, '0,-2'), false, 'but no further');
    const boss = createEnemy('cindervex', 0, 0, '0,0', {});
    equal(withinLeash(exp, boss, '0,-2'), true, 'a boss ranges wider');
    equal(withinLeash(exp, boss, '0,-3'), false);
  });

  test('a monster that loses its quarry goes back to its room', () => {
    const { exp, room } = corridorWorld(['rogue']);
    const rogue = exp.party[0];
    const centre = roomCenter(room.x, room.y);
    const foe = createEnemy('goblin_skirmisher', centre.x, centre.y, room.key, {});
    exp.addEnemy(foe, room);
    place(rogue, roomCenter(0, 0).x, roomCenter(0, 0).y, '0,0');
    rogue.order = 'hold';
    rogue.orderPoint = { x: rogue.x, y: rogue.y };
    // A decoy, not a duellist: this test is about the chase, so the rogue must
    // not simply kill the thing chasing it.
    rogue.damage = 0;
    rogue.maxHp = 9999;
    rogue.hp = 9999;
    foe.targetId = rogue.id;

    simulate(exp, 8);
    assert(foe.alive, 'the goblin survived to do the chasing');
    equal(foe.roomKey, '0,0', 'it followed the rogue next door');

    // The rogue gets away clean; there is now nothing to chase.
    rogue.alive = false;
    simulate(exp, 30);
    assert(foe.alive, 'and is still around to go home');
    equal(foe.roomKey, foe.homeKey, 'and went back to guarding its room');
  });

  test('a monster killed away from home still clears its own room', () => {
    const { exp, room } = corridorWorld(['fighter']);
    const centre = roomCenter(room.x, room.y);
    const foe = createEnemy('goblin_skirmisher', centre.x, centre.y, room.key, {});
    exp.addEnemy(foe, room);
    equal(room.enemyIds.length, 1);
    // It wanders next door and dies there.
    foe.roomKey = '0,0';
    exp.kill(foe, exp.party[0]);
    equal(room.enemyIds.length, 0, 'the room it belonged to is empty again');
  });
});

group('pursuit: the exploit itself', () => {
  /** A whole expedition for one party composition, totalling damage taken. */
  function expedition(seed, classes, seconds = 150) {
    const rng = new RNG(seed);
    const roster = classes.map((c) => createAdventurer(rng, { classId: c, traits: [] }));
    const deck = STARTER_CARDS.concat(['monster_den', 'crypt', 'guard_post', 'ossuary']);
    const exp = new Expedition({ rng, roster, deckCards: deck, guild: {} });
    const dt = 1 / 30;
    let taken = 0;
    for (let step = 0; step < seconds * 30; step++) {
      if (step % 150 === 0) {
        outer: for (const entry of exp.deck.hand.slice()) {
          for (let rot = 0; rot < entry.rotations; rot++) {
            entry.rotation = rot;
            const cells = legalCells(exp.dungeon.rooms, rotateDoors(entry.card.doors, rot));
            if (!cells.length) continue;
            cells.sort((a, b) => Math.abs(b.x) + Math.abs(b.y) - Math.abs(a.x) - Math.abs(a.y));
            if (exp.placeCard(entry.uid, cells[0].x, cells[0].y).ok) break outer;
          }
        }
      }
      const before = exp.party.reduce((a, p) => a + (p.alive ? p.hp : 0), 0);
      exp.update(dt);
      const after = exp.party.reduce((a, p) => a + (p.alive ? p.hp : 0), 0);
      if (after < before) taken += before - after;
      if (exp.outcome) break;
    }
    return { taken, kills: exp.kills, depth: exp.dungeon.deepestEntered() };
  }

  /**
   * The bug as it was reported: a party of mages walked the whole dungeon
   * taking almost nothing, because monsters could neither follow them nor
   * notice them. They should still take less than a line of melee — that is
   * what ranged is for — but not a tenth as much.
   */
  test('a whole run of mages is not an order of magnitude safer than melee', () => {
    let mages = 0;
    let melee = 0;
    for (const seed of [1, 2, 3]) {
      mages += expedition(seed, ['mage', 'mage', 'mage', 'mage']).taken;
      melee += expedition(seed, ['fighter', 'fighter', 'rogue', 'cleric']).taken;
    }
    atLeast(melee, 1, 'the melee party met something');
    const ratio = mages / melee;
    assert(ratio > 0.3, `mages took ${Math.round(mages)} where melee took ${Math.round(melee)} (${ratio.toFixed(2)}×)`);
  });
});
