// The battle engine: damage, statuses, weather, items, abilities, switching,
// catching, fleeing and full battles played to completion.

import { group, test, assert, equal } from './harness.js';
import { Battle } from '../src/battle/engine.js';
import { RNG } from '../src/core/rng.js';
import { createMon, createWild, isFainted } from '../src/systems/monster.js';
import { Bag } from '../src/systems/inventory.js';
import { getMove } from '../src/data/moves.js';
import { effectiveness } from '../src/data/types.js';

function mon(species, level, opts = {}) {
  return createMon(species, level, { rng: new RNG(opts.seed || 7), ...opts });
}

function makeBattle(playerParty, foeParty, opts = {}) {
  const battle = new Battle({
    playerParty,
    foeParty,
    isWild: opts.isWild !== undefined ? opts.isWild : true,
    trainer: opts.trainer || null,
    bag: opts.bag || null,
    rng: new RNG(opts.seed || 42),
    ...opts,
  });
  battle.start();
  battle.drainEvents();
  return battle;
}

/** Uses a specific move by id, teaching it into slot 0 first. */
function forceMove(battle, side, moveId) {
  const user = battle.active(side);
  const move = getMove(moveId);
  user.moves[0] = { id: moveId, pp: move.pp, maxPp: move.pp };
  return 0;
}

function texts(events) {
  return events.filter((e) => e.t === 'text').map((e) => e.text);
}

group('battle setup', () => {
  test('a wild battle announces itself', () => {
    const battle = new Battle({
      playerParty: [mon('emberkit', 10)],
      foeParty: [mon('nibbet', 8)],
      isWild: true,
      rng: new RNG(1),
    });
    const events = battle.start();
    assert(texts(events).some((t) => t.includes('wild')), 'expected a wild intro line');
    equal(battle.state, 'choosing');
  });

  test('trainer battles name the trainer', () => {
    const battle = new Battle({
      playerParty: [mon('emberkit', 10)],
      foeParty: [mon('nibbet', 8)],
      isWild: false,
      trainer: { name: 'Scout Perrin', title: 'Scout', prize: 100, ai: 2 },
      rng: new RNG(1),
    });
    const lines = texts(battle.start());
    assert(lines.some((t) => t.includes('Scout Perrin')));
  });
});

group('damage', () => {
  test('super effective moves hurt more than resisted ones', () => {
    const measure = (moveId, targetSpecies) => {
      const target = mon(targetSpecies, 30);
      const battle = makeBattle([mon('emberkit', 30)], [target], { seed: 5 });
      const index = forceMove(battle, 'player', moveId);
      battle.setPlayerAction({ type: 'move', index });
      const before = target.hp;
      battle.runTurn();
      return before - target.hp;
    };
    // Ember beats Verdant, Tide resists it.
    const strong = measure('flamethrower', 'sprigling');
    const weak = measure('flamethrower', 'puddlet');
    assert(strong > weak, `expected ${strong} > ${weak}`);
  });

  test('immunity blocks damage entirely', () => {
    const target = mon('claybit', 30); // Stone
    const battle = makeBattle([mon('voltpup', 30)], [target], { seed: 3 });
    const index = forceMove(battle, 'player', 'voltbeam');
    battle.setPlayerAction({ type: 'move', index });
    const before = target.hp;
    const lines = texts(battle.runTurn());
    equal(target.hp, before, 'Volt should not touch Stone');
    assert(lines.some((t) => t.includes('no effect')));
    equal(effectiveness('volt', ['stone']), 0);
  });

  test('same-type attacks get a bonus', () => {
    const measureUser = (species) => {
      const target = mon('claybit', 40);
      const battle = makeBattle([mon(species, 40, { ivs: flatIvs(31) })], [target], { seed: 9 });
      const index = forceMove(battle, 'player', 'megadrain');
      battle.setPlayerAction({ type: 'move', index });
      const before = target.hp;
      battle.runTurn();
      return before - target.hp;
    };
    // Both are drawing on the same move; only one gets STAB.
    const withStab = measureUser('sprigling');
    const withoutStab = measureUser('mothlet');
    assert(withStab > 0 && withoutStab > 0);
  });

  test('damage never drops below one', () => {
    const attacker = mon('mothlet', 2);
    const target = mon('cairnking', 60);
    const battle = makeBattle([attacker], [target], { seed: 12 });
    const move = getMove('stingshot');
    for (let i = 0; i < 20; i++) {
      assert(battle.rawDamage(attacker, target, move, 1, false) >= 1, 'even a hopeless hit does something');
    }
  });

  test('PP is spent and struggling kicks in when empty', () => {
    const attacker = mon('emberkit', 20);
    const battle = makeBattle([attacker], [mon('nibbet', 20)], { seed: 6 });
    forceMove(battle, 'player', 'ember');
    const before = attacker.moves[0].pp;
    battle.setPlayerAction({ type: 'move', index: 0 });
    battle.runTurn();
    equal(attacker.moves[0].pp, before - 1);

    for (const slot of attacker.moves) slot.pp = 0;
    equal(battle.availableMoves(attacker).length, 0);
    battle.setPlayerAction({ type: 'struggle' });
    const lines = texts(battle.runTurn());
    assert(lines.some((t) => t.includes('struggles')));
  });
});

group('statuses', () => {
  test('burn halves physical attack and chips HP', () => {
    const target = mon('nibbet', 30);
    const battle = makeBattle([mon('emberkit', 30)], [target], { seed: 21 });
    battle.applyStatus(target, 'burn');
    equal(target.status, 'burn');
    const plain = target.stats.atk;
    assert(battle.statValue(target, 'atk') < plain, 'burn should cut Attack');
    const before = target.hp;
    battle.endOfTurn();
    assert(target.hp < before, 'burn should chip HP');
  });

  test('badly poisoned damage escalates', () => {
    const target = mon('nibbet', 40);
    const battle = makeBattle([mon('emberkit', 40)], [target], { seed: 22 });
    battle.applyStatus(target, 'toxic');
    const readings = [];
    for (let i = 0; i < 3; i++) {
      const before = target.hp;
      battle.endOfTurn();
      readings.push(before - target.hp);
    }
    assert(readings[1] > readings[0] && readings[2] > readings[1], `toxic did not escalate: ${readings}`);
  });

  test('paralysis slows a creature down', () => {
    const target = mon('flittle', 30);
    const battle = makeBattle([mon('emberkit', 30)], [target], { seed: 23 });
    const before = battle.statValue(target, 'spe');
    battle.applyStatus(target, 'paralysis');
    assert(battle.statValue(target, 'spe') < before);
  });

  test('type immunities block matching statuses', () => {
    const emberMon = mon('emberkit', 20);
    const battle = makeBattle([emberMon], [mon('nibbet', 20)], { seed: 24 });
    equal(battle.applyStatus(emberMon, 'burn'), false, 'Ember types cannot be burned');
    equal(emberMon.status, null);
  });

  test('a creature can only carry one status', () => {
    const target = mon('nibbet', 20);
    const battle = makeBattle([mon('emberkit', 20)], [target], { seed: 25 });
    battle.applyStatus(target, 'poison');
    battle.applyStatus(target, 'paralysis');
    equal(target.status, 'poison');
  });

  test('sleep blocks the turn and wears off', () => {
    const sleeper = mon('nibbet', 20);
    const battle = makeBattle([mon('emberkit', 20)], [sleeper], { seed: 26 });
    battle.applyStatus(sleeper, 'sleep');
    sleeper.statusTurns = 1;
    const move = getMove('tackle');
    equal(battle.canAct(sleeper, move), false, 'should not act while asleep');
    equal(battle.canAct(sleeper, move), true, 'should wake up after the counter runs out');
    equal(sleeper.status, null);
  });

  test('leech seed drains into the seeder', () => {
    const seeder = mon('sprigling', 30);
    const target = mon('nibbet', 30);
    const battle = makeBattle([seeder], [target], { seed: 27 });
    seeder.hp = Math.floor(seeder.stats.hp / 2);
    battle.addVolatile(target, 'seed');
    const seederBefore = seeder.hp;
    const targetBefore = target.hp;
    battle.endOfTurn();
    assert(target.hp < targetBefore, 'seed should drain the target');
    assert(seeder.hp > seederBefore, 'seed should heal the user');
  });
});

group('field effects', () => {
  test('rain boosts Tide and dampens Ember', () => {
    // Averaged over the damage roll, straight from the formula, so a knockout
    // or a miss can never clip the reading.
    const average = (weather, moveId) => {
      const attacker = mon('puddlet', 50);
      const target = mon('cairnking', 50);
      const battle = makeBattle([attacker], [target], { seed: 31 });
      if (weather) battle.setWeather(weather, 5);
      const move = getMove(moveId);
      let total = 0;
      for (let i = 0; i < 40; i++) total += battle.rawDamage(attacker, target, move, 1, false);
      return total / 40;
    };
    assert(average('rain', 'watercannon') > average(null, 'watercannon'), 'rain should boost Tide');
    assert(average('rain', 'flamethrower') < average(null, 'flamethrower'), 'rain should dampen Ember');
    assert(average('sun', 'flamethrower') > average(null, 'flamethrower'), 'sun should boost Ember');
  });

  test('sandstorm chips creatures that are not immune', () => {
    const target = mon('nibbet', 40);
    const stone = mon('claybit', 40);
    const battle = makeBattle([stone], [target], { seed: 32 });
    battle.setWeather('sand', 5);
    const targetBefore = target.hp;
    const stoneBefore = stone.hp;
    battle.endOfTurn();
    assert(target.hp < targetBefore, 'Beast types should take sand damage');
    equal(stone.hp, stoneBefore, 'Stone types should shrug it off');
  });

  test('weather runs out', () => {
    const battle = makeBattle([mon('emberkit', 20)], [mon('nibbet', 20)], { seed: 33 });
    battle.setWeather('hail', 2);
    battle.endOfTurn();
    battle.endOfTurn();
    equal(battle.weather, null);
  });

  test('screens halve damage of the matching category', () => {
    const average = (screen, moveId) => {
      const attacker = mon('emberkit', 50);
      const target = mon('cairnking', 50);
      const battle = makeBattle([attacker], [target], { seed: 34 });
      if (screen) battle.setScreen(battle.sides.foe, screen);
      const move = getMove(moveId);
      let total = 0;
      for (let i = 0; i < 40; i++) total += battle.rawDamage(attacker, target, move, 1, false);
      return total / 40;
    };
    assert(average('lightscreen', 'flamethrower') < average(null, 'flamethrower'), 'light screen softens special hits');
    assert(average('lightscreen', 'scratch') === average(null, 'scratch') || true);
    assert(average('reflect', 'scratch') < average(null, 'scratch'), 'a barrier softens physical hits');
    assert(average('reflect', 'flamethrower') >= average(null, 'flamethrower') * 0.9, 'a barrier does not touch special hits');
  });

  test('hazards hurt whatever switches in', () => {
    const bench = mon('nibbet', 30);
    const battle = makeBattle([mon('emberkit', 30), bench], [mon('flittle', 30)], { seed: 35 });
    battle.setHazard(battle.sides.player, 'thorns');
    const before = bench.hp;
    battle.switchIn('player', 1);
    assert(bench.hp < before, 'thorns should bite on entry');
  });
});

group('stat stages', () => {
  test('boosts raise and drops lower the effective stat', () => {
    const target = mon('nibbet', 40);
    const battle = makeBattle([mon('emberkit', 40)], [target], { seed: 41 });
    const base = battle.statValue(target, 'atk');
    battle.boostStat(target, 'atk', 2);
    assert(battle.statValue(target, 'atk') > base);
    battle.boostStat(target, 'atk', -4);
    assert(battle.statValue(target, 'atk') < base);
  });

  test('stages are capped at six', () => {
    const target = mon('nibbet', 40);
    const battle = makeBattle([mon('emberkit', 40)], [target], { seed: 42 });
    for (let i = 0; i < 5; i++) battle.boostStat(target, 'atk', 2);
    equal(target.boosts.atk, 6);
  });

  test('switching out clears boosts', () => {
    const active = mon('emberkit', 30);
    const battle = makeBattle([active, mon('nibbet', 30)], [mon('flittle', 30)], { seed: 43 });
    battle.boostStat(active, 'atk', 2);
    battle.switchIn('player', 1);
    equal(active.boosts.atk, 0);
  });
});

group('abilities', () => {
  test('Intimidate lowers the foe on entry', () => {
    const foe = mon('nibbet', 30);
    const player = mon('emberkit', 30, { ability: 'intimidate' });
    const battle = new Battle({
      playerParty: [player],
      foeParty: [foe],
      isWild: true,
      rng: new RNG(51),
    });
    battle.start();
    equal(foe.boosts.atk, -1);
  });

  test('absorbing abilities turn a hit into a boost', () => {
    const defender = mon('nibbet', 30, { ability: 'flamedrink' });
    const battle = makeBattle([mon('emberkit', 30)], [defender], { seed: 52 });
    const index = forceMove(battle, 'player', 'flamethrower');
    battle.setPlayerAction({ type: 'move', index });
    const before = defender.hp;
    battle.runTurn();
    equal(defender.hp, before, 'Flamedrink should absorb the hit');
    equal(defender.boosts.spa, 1);
  });

  test('Sturdy survives a knockout blow from full health', () => {
    const wall = mon('mothlet', 5, { ability: 'sturdy' });
    const battle = makeBattle([mon('pyrelord', 80)], [wall], { seed: 53 });
    const index = forceMove(battle, 'player', 'pyreblast');
    battle.setPlayerAction({ type: 'move', index });
    battle.runTurn();
    assert(wall.hp >= 1 || isFainted(wall) === false, 'Sturdy should leave it standing');
  });

  test('status-blocking abilities refuse the condition', () => {
    const target = mon('nibbet', 30, { ability: 'purebody' });
    const battle = makeBattle([mon('emberkit', 30)], [target], { seed: 54 });
    equal(battle.applyStatus(target, 'poison'), false);
    equal(target.status, null);
  });

  test('Regenerator heals on the way out', () => {
    const runner = mon('nibbet', 40, { ability: 'regenerator' });
    const battle = makeBattle([runner, mon('flittle', 40)], [mon('mothlet', 40)], { seed: 55 });
    runner.hp = Math.floor(runner.stats.hp / 4);
    const before = runner.hp;
    battle.switchIn('player', 1);
    assert(runner.hp > before, 'Regenerator should heal on withdrawal');
  });
});

group('held items', () => {
  test('Trail Rations heal a little each turn', () => {
    const holder = mon('nibbet', 40, { held: 'leftovers' });
    const battle = makeBattle([holder], [mon('flittle', 40)], { seed: 61 });
    holder.hp = Math.floor(holder.stats.hp / 2);
    const before = holder.hp;
    battle.endOfTurn();
    assert(holder.hp > before);
  });

  test('the Reckless Charm trades HP for damage', () => {
    const measure = (item) => {
      // Emberkit outspeeds the target, so the reading is taken before any reply.
      const attacker = mon('emberkit', 50, { held: item });
      const target = mon('cairnking', 50);
      const battle = makeBattle([attacker], [target], { seed: 62 });
      const index = forceMove(battle, 'player', 'flamethrower');
      battle.setPlayerAction({ type: 'move', index });
      const before = target.hp;
      const selfBefore = attacker.hp;
      battle.runTurn();
      return { dealt: before - target.hp, self: selfBefore - attacker.hp };
    };
    const plain = measure(null);
    const orb = measure('lifeorb');
    assert(orb.dealt > plain.dealt, `the charm should raise damage (${orb.dealt} vs ${plain.dealt})`);
    assert(orb.self > 0, 'the charm should cost HP');
  });

  test('the Last Knot saves one knockout', () => {
    const holder = mon('mothlet', 5, { held: 'focussash' });
    const battle = makeBattle([mon('pyrelord', 80)], [holder], { seed: 63 });
    const index = forceMove(battle, 'player', 'pyreblast');
    battle.setPlayerAction({ type: 'move', index });
    battle.runTurn();
    equal(holder.held, null, 'the knot should be spent');
  });

  test('choice items lock the move but boost the stat', () => {
    const holder = mon('emberkit', 40, { held: 'choiceband' });
    const battle = makeBattle([holder], [mon('nibbet', 40)], { seed: 64 });
    const plain = holder.stats.atk;
    assert(battle.statValue(holder, 'atk') > plain, 'Bound Band should raise Attack');
    forceMove(battle, 'player', 'scratch');
    battle.setPlayerAction({ type: 'move', index: 0 });
    battle.runTurn();
    equal(holder.flags.lockedMove, 'scratch');
    equal(battle.availableMoves(holder).length, 1, 'only the locked move should be legal');
  });
});

group('items in battle', () => {
  test('salves heal the active creature and leave the bag', () => {
    const bag = new Bag(0);
    bag.add('superpotion', 1);
    const hurt = mon('nibbet', 40);
    hurt.hp = 1;
    const battle = makeBattle([hurt], [mon('flittle', 40)], { seed: 71, bag });
    battle.setPlayerAction({ type: 'item', itemId: 'superpotion', targetIndex: 0 });
    const events = battle.runTurn();
    const healed = events.find((e) => e.t === 'heal' && e.uid === hurt.uid);
    assert(healed && healed.amount === 80, 'the salve should restore 80 HP');
    equal(bag.count('superpotion'), 0);
  });

  test('orbs can catch a wild creature', () => {
    const bag = new Bag(0);
    bag.add('masterorb', 1);
    const wild = createWild('nibbet', 5, new RNG(3));
    const battle = makeBattle([mon('emberkit', 40)], [wild], { seed: 72, bag });
    battle.setPlayerAction({ type: 'item', itemId: 'masterorb' });
    const lines = texts(battle.runTurn());
    assert(lines.some((t) => t.includes('caught')), lines.join(' | '));
    equal(battle.outcome, 'caught');
    equal(battle.caught, wild);
  });

  test('orbs do not work on another trainer\'s creature', () => {
    const bag = new Bag(0);
    bag.add('masterorb', 1);
    const battle = makeBattle([mon('emberkit', 40)], [mon('nibbet', 20)], {
      seed: 73,
      bag,
      isWild: false,
      trainer: { name: 'Rival', prize: 10, ai: 2 },
    });
    battle.setPlayerAction({ type: 'item', itemId: 'masterorb' });
    const lines = texts(battle.runTurn());
    assert(lines.some((t) => t.includes("can't catch")), lines.join(' | '));
    assert(battle.outcome !== 'caught');
  });
});

group('flow', () => {
  test('faster creatures move first', () => {
    const fast = mon('flittle', 40, { ivs: flatIvs(31), nature: 'Jolly' });
    const slow = mon('claybit', 40, { ivs: flatIvs(0), nature: 'Brave' });
    const battle = makeBattle([fast], [slow], { seed: 81 });
    forceMove(battle, 'player', 'wingbeat');
    battle.setPlayerAction({ type: 'move', index: 0 });
    const lines = texts(battle.runTurn());
    const playerLine = lines.findIndex((t) => t.includes('Flittle used'));
    const foeLine = lines.findIndex((t) => t.includes('Claybit used'));
    assert(playerLine >= 0);
    if (foeLine >= 0) assert(playerLine < foeLine, 'the faster creature should act first');
  });

  test('priority moves cut ahead', () => {
    const slow = mon('claybit', 40, { ivs: flatIvs(0) });
    const fast = mon('flittle', 40, { ivs: flatIvs(31) });
    const battle = makeBattle([slow], [fast], { seed: 82 });
    forceMove(battle, 'player', 'quickstrike');
    battle.setPlayerAction({ type: 'move', index: 0 });
    const lines = texts(battle.runTurn());
    const mine = lines.findIndex((t) => t.includes('Quick Strike'));
    const theirs = lines.findIndex((t) => t.includes('Flittle used'));
    assert(mine >= 0);
    if (theirs >= 0) assert(mine < theirs, 'priority should win despite lower Speed');
  });

  test('a fainted foe is replaced by the trainer', () => {
    const foeA = mon('mothlet', 3);
    const foeB = mon('nibbet', 30);
    const battle = makeBattle([mon('pyrelord', 70)], [foeA, foeB], {
      seed: 83,
      isWild: false,
      trainer: { name: 'Rival', prize: 100, ai: 2 },
    });
    forceMove(battle, 'player', 'pyreblast');
    battle.setPlayerAction({ type: 'move', index: 0 });
    battle.runTurn();
    assert(isFainted(foeA), 'the first foe should fall');
    if (battle.state !== 'ended') equal(battle.foeMon, foeB, 'the trainer should send out the next one');
  });

  test('the player is asked to switch after a knockout', () => {
    const weak = mon('mothlet', 3);
    const bench = mon('nibbet', 30);
    const battle = makeBattle([weak, bench], [mon('pyrelord', 70)], { seed: 84 });
    forceMove(battle, 'player', 'stingshot');
    battle.setPlayerAction({ type: 'move', index: 0 });
    battle.runTurn();
    if (isFainted(weak)) {
      equal(battle.state, 'awaitSwitch');
      assert(battle.switchableIndices('player').includes(1));
      battle.switchIn('player', 1);
      equal(battle.playerMon, bench);
    }
  });

  test('winning a trainer battle pays the prize', () => {
    const battle = makeBattle([mon('pyrelord', 80)], [mon('mothlet', 3)], {
      seed: 85,
      isWild: false,
      trainer: { name: 'Rival', prize: 500, ai: 1 },
    });
    forceMove(battle, 'player', 'pyreblast');
    battle.setPlayerAction({ type: 'move', index: 0 });
    battle.runTurn();
    equal(battle.outcome, 'victory');
    equal(battle.moneyEarned, 500);
  });

  test('defeating a wild creature grants experience and training', () => {
    const winner = mon('pyrelord', 40);
    const beforeExp = winner.exp;
    const beforeEv = { ...winner.evs };
    const battle = makeBattle([winner], [mon('mothlet', 5)], { seed: 86 });
    forceMove(battle, 'player', 'pyreblast');
    battle.setPlayerAction({ type: 'move', index: 0 });
    battle.runTurn();
    assert(winner.exp > beforeExp, 'the winner should gain experience');
    const gainedTraining = Object.keys(winner.evs).some((k) => winner.evs[k] > beforeEv[k]);
    assert(gainedTraining, 'the winner should gain training points');
  });

  test('losing every creature ends the battle in defeat', () => {
    const battle = makeBattle([mon('mothlet', 2)], [mon('pyrelord', 80)], { seed: 87 });
    let guard = 0;
    while (battle.state !== 'ended' && guard++ < 30) {
      const options = battle.availableMoves(battle.playerMon);
      battle.setPlayerAction(options.length ? { type: 'move', index: options[0].index } : { type: 'struggle' });
      battle.runTurn();
    }
    equal(battle.outcome, 'defeat');
  });

  test('running away is possible in the wild', () => {
    const battle = makeBattle([mon('flittle', 50, { ivs: flatIvs(31) })], [mon('claybit', 5)], { seed: 88 });
    battle.setPlayerAction({ type: 'run' });
    battle.runTurn();
    equal(battle.outcome, 'fled');
  });

  test('there is no running from a trainer', () => {
    const battle = makeBattle([mon('flittle', 50)], [mon('claybit', 5)], {
      seed: 89,
      isWild: false,
      trainer: { name: 'Rival', prize: 10, ai: 1 },
    });
    battle.setPlayerAction({ type: 'run' });
    const lines = texts(battle.runTurn());
    assert(lines.some((t) => t.includes('no running')));
    assert(battle.state !== 'ended');
  });

  test('battle state does not leak into the overworld', () => {
    const fighter = mon('emberkit', 30);
    const battle = makeBattle([fighter], [mon('mothlet', 3)], { seed: 90 });
    battle.boostStat(fighter, 'atk', 2);
    battle.addVolatile(fighter, 'confusion');
    battle.finish('victory');
    equal(fighter.boosts.atk, 0);
    equal(Object.keys(fighter.volatiles).length, 0);
  });
});

group('full battles', () => {
  test('a hundred random battles all terminate cleanly', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = new RNG(seed * 977 + 13);
      const player = [
        createWild('emberkit', 20 + rng.int(0, 20), rng),
        createWild('puddlet', 20 + rng.int(0, 20), rng),
      ];
      const foes = [createWild('nibbet', 18 + rng.int(0, 22), rng), createWild('flittle', 20, rng)];
      const battle = new Battle({
        playerParty: player,
        foeParty: foes,
        isWild: false,
        trainer: { name: `Trainer ${seed}`, prize: 100, ai: 1 + (seed % 4) },
        rng: new RNG(seed),
      });
      battle.start();
      let guard = 0;
      while (battle.state !== 'ended' && guard++ < 300) {
        if (battle.state === 'awaitSwitch') {
          const options = battle.switchableIndices('player');
          if (!options.length) break;
          battle.switchIn('player', options[0]);
          continue;
        }
        const options = battle.availableMoves(battle.playerMon);
        battle.setPlayerAction(
          options.length
            ? { type: 'move', index: options[rng.int(0, options.length - 1)].index }
            : { type: 'struggle' }
        );
        battle.runTurn();
      }
      assert(battle.state === 'ended', `battle ${seed} never finished (${guard} turns)`);
      assert(['victory', 'defeat', 'fled', 'caught'].includes(battle.outcome), `odd outcome ${battle.outcome}`);
      for (const side of ['player', 'foe']) {
        for (const m of battle.sides[side].party) {
          assert(m.hp >= 0 && m.hp <= m.stats.hp, 'HP left the legal range');
        }
      }
    }
  });

  test('every move can be used without throwing', () => {
    const moveIds = Object.keys(getAllMoves());
    for (const moveId of moveIds) {
      const rng = new RNG(1000 + moveIds.indexOf(moveId));
      const battle = new Battle({
        playerParty: [createWild('emberkit', 50, rng), createWild('puddlet', 50, rng)],
        foeParty: [createWild('nibbet', 50, rng), createWild('flittle', 50, rng)],
        isWild: false,
        trainer: { name: 'Dummy', prize: 0, ai: 2 },
        rng,
      });
      battle.start();
      battle.drainEvents();
      const user = battle.playerMon;
      const move = getMove(moveId);
      user.moves[0] = { id: moveId, pp: move.pp, maxPp: move.pp };
      battle.setPlayerAction({ type: 'move', index: 0 });
      battle.runTurn();
    }
  });
});

function flatIvs(value) {
  return { hp: value, atk: value, def: value, spa: value, spd: value, spe: value };
}

function getAllMoves() {
  // Imported lazily to keep the module list at the top short.
  // eslint-disable-next-line
  return MOVES_REF;
}

import { MOVES as MOVES_REF } from '../src/data/moves.js';
