import { assert, atLeast, equal, group, near, test } from './harness.js';
import {
  applyDamage, applyStatus, basicAttack, hasStatus, healActor, mitigate, statusMods,
  tickCooldowns, tickStatuses, tryAbilities, tryMonsterAbilities,
} from '../src/systems/combat.js';
import { createAdventurer, createEnemy, deployAdventurer } from '../src/systems/actors.js';
import { RNG } from '../src/core/rng.js';

function stubWorld(overrides = {}) {
  const world = {
    killed: [],
    bursts: 0,
    projectiles: [],
    floatText() {},
    burst() { world.bursts++; },
    kill(target) { target.alive = false; world.killed.push(target); },
    spawnProjectile(spec) { world.projectiles.push(spec); },
    summon() {},
    hostilesNear: () => [],
    alliesNear: () => [],
  };
  return Object.assign(world, overrides);
}

function makeParty(rng, classId, traits = []) {
  return deployAdventurer(createAdventurer(rng, { classId, traits }), 0, 0);
}


group('combat: the damage formula', () => {
  test('armour blunts damage but never stops it entirely', () => {
    assert(mitigate(10, 0) > mitigate(10, 10), 'more armour, less damage');
    atLeast(mitigate(1, 99), 1, 'a hit always lands for something');
  });

  test('damage comes off health and reports what it did', () => {
    const foe = createEnemy('goblin_skirmisher', 0, 0, '0,0', {});
    const world = stubWorld();
    const before = foe.hp;
    const result = applyDamage(null, foe, 12, world, { noCrit: true });
    assert(result.dealt > 0);
    near(foe.hp, before - result.dealt, 0.001);
  });

  test('a killing blow tells the world once', () => {
    const foe = createEnemy('cave_spider', 0, 0, '0,0', {});
    const world = stubWorld();
    applyDamage(null, foe, 9999, world);
    equal(foe.alive, false);
    equal(world.killed.length, 1);
    applyDamage(null, foe, 9999, world);
    equal(world.killed.length, 1, 'the dead are not killed twice');
  });

  test('a shield is spent before health is', () => {
    const rng = new RNG(2);
    const adv = makeParty(rng, 'fighter');
    const world = stubWorld();
    applyStatus(adv, 'shield', 10, 40);
    const before = adv.hp;
    applyDamage(null, adv, 20, world, { kind: 'tick' });
    equal(adv.hp, before, 'the ward took all of it');
    assert(adv.statuses.find((s) => s.id === 'shield').power < 40);
  });

  test('fire resistance reduces fire specifically', () => {
    const rng = new RNG(3);
    const adv = makeParty(rng, 'fighter');
    adv.fireResist = 0.5;
    const world = stubWorld();
    const plain = applyDamage(null, adv, 20, world, { noCrit: true, kind: 'tick' }).dealt;
    adv.hp = adv.maxHp;
    const burned = applyDamage(null, adv, 20, world, { noCrit: true, kind: 'tick', element: 'fire' }).dealt;
    assert(burned < plain, 'the locket earns its keep');
  });
});

group('combat: statuses', () => {
  test('burning chips away and then wears off', () => {
    const foe = createEnemy('skeleton_warrior', 0, 0, '0,0', {});
    const world = stubWorld();
    applyStatus(foe, 'burn', 2, 5);
    const before = foe.hp;
    tickStatuses(foe, 1, world);
    assert(foe.hp < before, 'it burns');
    tickStatuses(foe, 1.5, world);
    equal(hasStatus(foe, 'burn'), false, 'and then it stops');
  });

  test('slow and haste move the speed multiplier the right way', () => {
    const foe = createEnemy('goblin_skirmisher', 0, 0, '0,0', {});
    applyStatus(foe, 'slow', 5, 0.5);
    assert(statusMods(foe).speed < 1);
    foe.statuses.length = 0;
    applyStatus(foe, 'haste', 5, 0.5);
    assert(statusMods(foe).speed > 1);
  });

  test('resistance shortens hostile statuses and spares helpful ones', () => {
    const rng = new RNG(4);
    const adv = makeParty(rng, 'cleric');
    adv.statusResist = 0.5;
    applyStatus(adv, 'poison', 10, 3);
    near(adv.statuses[0].duration, 5, 0.01);
    applyStatus(adv, 'bless', 10, 0.2);
    near(adv.statuses[1].duration, 10, 0.01);
  });

  test('stun stops an actor acting', () => {
    const foe = createEnemy('ghoul', 0, 0, '0,0', {});
    applyStatus(foe, 'stun', 2, 1);
    equal(statusMods(foe).stunned, true);
  });

  test('healing is capped at full health and blunted by rot', () => {
    const rng = new RNG(5);
    const adv = makeParty(rng, 'fighter');
    const world = stubWorld();
    adv.hp = 10;
    healActor(adv, 5, world);
    near(adv.hp, 15, 0.001);
    applyStatus(adv, 'rot', 10, 1);
    adv.hp = 10;
    healActor(adv, 10, world);
    assert(adv.hp < 20, 'rot makes healing worse');
    adv.statuses.length = 0;
    healActor(adv, 9999, world);
    equal(adv.hp, adv.maxHp);
  });
});

group('combat: attacks and abilities', () => {
  test('a melee swing damages, a ranged attack throws something', () => {
    const rng = new RNG(6);
    const fighter = makeParty(rng, 'fighter');
    const mage = makeParty(rng, 'mage');
    const foe = createEnemy('goblin_skirmisher', 10, 0, '0,0', {});
    const world = stubWorld();
    basicAttack(fighter, foe, world);
    assert(foe.hp < foe.maxHp, 'the sword connects');
    equal(world.projectiles.length, 0);
    basicAttack(mage, foe, world);
    equal(world.projectiles.length, 1, 'the mage throws a bolt instead');
  });

  test('a fighter cleaves only when there is a crowd', () => {
    const rng = new RNG(7);
    const fighter = makeParty(rng, 'fighter');
    const one = createEnemy('goblin_skirmisher', 12, 0, '0,0', {});
    const two = createEnemy('goblin_skirmisher', 18, 4, '0,0', {});
    let foes = [one];
    const world = stubWorld({ hostilesNear: () => foes, alliesNear: () => [] });
    equal(tryAbilities(fighter, world), null, 'one goblin is not a crowd');
    foes = [one, two];
    const fired = tryAbilities(fighter, world);
    assert(fired && fired.ability.id === 'cleave', 'two is');
    assert(one.hp < one.maxHp && two.hp < two.maxHp, 'both take it');
  });

  test('abilities respect their cooldown', () => {
    const rng = new RNG(8);
    const fighter = makeParty(rng, 'fighter');
    const foes = [
      createEnemy('goblin_skirmisher', 12, 0, '0,0', {}),
      createEnemy('goblin_skirmisher', 16, 6, '0,0', {}),
    ];
    const world = stubWorld({ hostilesNear: () => foes, alliesNear: () => [] });
    assert(tryAbilities(fighter, world), 'fires once');
    equal(tryAbilities(fighter, world), null, 'and not again immediately');
    tickCooldowns(fighter, 99);
    assert(tryAbilities(fighter, world), 'until it is ready');
  });

  test('a cleric mends the worst-hurt ally without being asked', () => {
    const rng = new RNG(9);
    const cleric = makeParty(rng, 'cleric');
    const hurt = makeParty(rng, 'rogue');
    hurt.hp = hurt.maxHp * 0.3;
    const world = stubWorld({ hostilesNear: () => [], alliesNear: () => [hurt] });
    const fired = tryAbilities(cleric, world);
    assert(fired && fired.ability.id === 'mend', 'the cleric decides on its own');
    assert(hurt.hp > hurt.maxHp * 0.3, 'and it helps');
  });

  test('smite only lands on the undead', () => {
    const rng = new RNG(10);
    const cleric = makeParty(rng, 'cleric');
    cleric.cooldowns.mend = 99;
    const living = createEnemy('goblin_skirmisher', 10, 0, '0,0', {});
    let foes = [living];
    const world = stubWorld({ hostilesNear: () => foes, alliesNear: () => [] });
    equal(tryAbilities(cleric, world), null);
    foes = [createEnemy('skeleton_warrior', 10, 0, '0,0', {})];
    const fired = tryAbilities(cleric, world);
    assert(fired && fired.ability.id === 'smite');
  });

  test('a boss uses its own abilities on a schedule', () => {
    const boss = createEnemy('cindervex', 0, 0, '0,0', {});
    const rng = new RNG(11);
    const victim = makeParty(rng, 'fighter');
    victim.x = 20;
    const world = stubWorld({ hostilesNear: () => [victim], alliesNear: () => [] });
    let fired = null;
    for (let t = 0; t < 30 && !fired; t += 0.1) fired = tryMonsterAbilities(boss, world, 0.1);
    assert(fired, 'the wyrm does something dramatic');
    assert(victim.hp < victim.maxHp, 'and it hurts');
  });
});
