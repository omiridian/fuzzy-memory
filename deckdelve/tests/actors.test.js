import { assert, atLeast, equal, group, near, test } from './harness.js';
import { createAdventurer, createEnemy, deployAdventurer, grantXp, refreshStats, xpForLevel } from '../src/systems/actors.js';
import { RNG } from '../src/core/rng.js';
import { CLASSES } from '../src/data/classes.js';

group('actors: adventurers', () => {
  test('a recruit gets a name, a class, traits and full health', () => {
    const adv = createAdventurer(new RNG(1), { classId: 'rogue' });
    assert(adv.name.includes(' '), 'first name and epithet');
    equal(adv.classId, 'rogue');
    atLeast(adv.traits.length, 1);
    equal(adv.hp, adv.maxHp);
  });

  test('levels make somebody tougher without healing them for free', () => {
    const adv = createAdventurer(new RNG(2), { classId: 'fighter', traits: [] });
    const hp1 = adv.maxHp;
    const dmg1 = adv.damage;
    adv.level = 5;
    refreshStats(adv);
    assert(adv.maxHp > hp1 && adv.damage > dmg1);
    assert(adv.hp <= adv.maxHp);
  });

  test('gear adds to the numbers it says it adds to', () => {
    const adv = createAdventurer(new RNG(3), { classId: 'fighter', traits: [] });
    const before = { dmg: adv.damage, arm: adv.armor, hp: adv.maxHp };
    adv.equipment.weapon = 'boarding_axe';
    adv.equipment.armor = 'guild_mail';
    refreshStats(adv);
    near(adv.damage, before.dmg + 7, 0.01);
    equal(adv.armor, before.arm + 3);
    equal(adv.maxHp, before.hp + 12);
  });

  test('traits shift behaviour numbers, not just flavour', () => {
    const coward = createAdventurer(new RNG(4), { classId: 'rogue', traits: ['coward'] });
    const reckless = createAdventurer(new RNG(4), { classId: 'rogue', traits: ['reckless'] });
    assert(coward.fleeThreshold > reckless.fleeThreshold, 'the coward leaves earlier');
    assert(reckless.damage > coward.damage, 'and hits softer for it');
  });

  test('experience accumulates and levels when it should', () => {
    const adv = createAdventurer(new RNG(5), { classId: 'cleric', traits: [] });
    const need = xpForLevel(2);
    const small = grantXp(adv, need - 1);
    equal(small.levels.length, 0);
    const enough = grantXp(adv, 2);
    equal(enough.levels[0], 2);
    equal(adv.level, 2);
  });

  test('a scholar learns faster than everyone else', () => {
    const plain = createAdventurer(new RNG(6), { classId: 'mage', traits: [] });
    const scholar = createAdventurer(new RNG(6), { classId: 'mage', traits: ['scholar'] });
    const a = grantXp(plain, 100).gained;
    const b = grantXp(scholar, 100).gained;
    assert(b > a);
  });

  test('deploying gives a body, a position and an order', () => {
    const adv = deployAdventurer(createAdventurer(new RNG(7), { classId: 'mage' }), 40, 50);
    equal(adv.x, 40);
    equal(adv.order, 'explore');
    equal(adv.roomKey, '0,0');
    equal(adv.side, 'party');
    assert(Array.isArray(adv.statuses));
  });

  test('every class produces a usable body', () => {
    for (const id of Object.keys(CLASSES)) {
      const adv = deployAdventurer(createAdventurer(new RNG(8), { classId: id }), 0, 0);
      atLeast(adv.maxHp, 20);
      atLeast(adv.damage, 1);
      atLeast(adv.abilities.length, 1);
    }
  });
});

group('actors: monsters', () => {
  test('a monster is built from its template', () => {
    const foe = createEnemy('goblin_skirmisher', 5, 6, '1,2', {});
    equal(foe.side, 'foe');
    equal(foe.roomKey, '1,2');
    equal(foe.hp, foe.maxHp);
    equal(foe.alive, true);
  });

  test('Threat and depth make monsters bigger', () => {
    const calm = createEnemy('ghoul', 0, 0, '0,0', {});
    const angry = createEnemy('ghoul', 0, 0, '0,0', { threat: 90, depth: 6 });
    assert(angry.maxHp > calm.maxHp * 1.5);
    assert(angry.damage > calm.damage);
  });

  test('an elite is a much worse version of the same thing', () => {
    const plain = createEnemy('skeleton_warrior', 0, 0, '0,0', {});
    const elite = createEnemy('skeleton_warrior', 0, 0, '0,0', { elite: true, prefix: 'Gilded' });
    assert(elite.maxHp > plain.maxHp * 2);
    assert(elite.name.startsWith('Gilded'));
    assert(elite.xp > plain.xp);
    assert(elite.scale > plain.scale);
  });

  test('bosses are never demoted to elites', () => {
    const boss = createEnemy('grumwick', 0, 0, '0,0', { elite: true });
    equal(boss.boss, true);
    equal(boss.elite, false);
    equal(boss.name, 'Grumwick, the Mimic King');
    atLeast(boss.abilities.length, 2);
  });

  test('a biome makes the locals worse', () => {
    const plain = createEnemy('goblin_skirmisher', 0, 0, '0,0', {});
    const warren = createEnemy('goblin_skirmisher', 0, 0, '0,0', { biomeBonus: { hp: 1.5, damage: 1.5 } });
    assert(warren.maxHp > plain.maxHp);
    assert(warren.damage > plain.damage);
  });
});
