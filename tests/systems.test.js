// Creature growth, the economy, saving, and the pieces the scenes lean on.

import { group, test, assert, equal, near } from './harness.js';
import { RNG, rngFromString } from '../src/core/rng.js';
import {
  createMon, createWild, computeStats, expForLevel, levelFromExp, gainExp, expAward,
  checkEvolution, evolveMon, attemptCapture, captureChance, addTraining, teachMove,
  canLearnMove, defaultMovesFor, healFully, rehydrateMon, MAX_TRAINING_TOTAL, statusCaptureBonus,
} from '../src/systems/monster.js';
import { Bag } from '../src/systems/inventory.js';
import { Party, Storage, PARTY_MAX } from '../src/systems/party.js';
import { Game } from '../src/systems/game.js';
import { QuestLog } from '../src/systems/questlog.js';
import { buildTrainerTeam } from '../src/systems/trainers.js';
import { DEX, getSpecies } from '../src/data/species.js';
import { NATURES } from '../src/data/natures.js';
import { rollEncounter, prepareMap, encounterPool } from '../src/world/world.js';

const rng = () => new RNG(1234);

group('rng', () => {
  test('is deterministic for a given seed', () => {
    const a = new RNG(99);
    const b = new RNG(99);
    for (let i = 0; i < 20; i++) equal(a.next(), b.next());
  });

  test('string seeding is stable', () => {
    equal(rngFromString('emberkit').next(), rngFromString('emberkit').next());
    assert(rngFromString('emberkit').next() !== rngFromString('puddlet').next());
  });

  test('weighted picks respect weights', () => {
    const r = new RNG(7);
    let heavy = 0;
    for (let i = 0; i < 2000; i++) if (r.weighted(['a', 'b'], [9, 1]) === 'a') heavy++;
    assert(heavy > 1700 && heavy < 1950, `weighted pick drifted: ${heavy}`);
  });
});

group('creatures', () => {
  test('stats follow level', () => {
    const low = createMon('emberkit', 5, { rng: rng(), ivs: allIvs(31), nature: 'Hardy' });
    const high = createMon('emberkit', 50, { rng: rng(), ivs: allIvs(31), nature: 'Hardy' });
    assert(high.stats.hp > low.stats.hp * 3, 'HP should scale steeply with level');
    for (const key of ['atk', 'def', 'spa', 'spd', 'spe']) {
      assert(high.stats[key] > low.stats[key], `${key} did not grow`);
    }
  });

  test('natures shift stats by 10%', () => {
    const neutral = createMon('emberkit', 50, { rng: rng(), ivs: allIvs(0), nature: 'Hardy' });
    const adamant = createMon('emberkit', 50, { rng: rng(), ivs: allIvs(0), nature: 'Adamant' });
    assert(adamant.stats.atk > neutral.stats.atk, 'Adamant should raise Attack');
    assert(adamant.stats.spa < neutral.stats.spa, 'Adamant should lower Sp. Atk');
    equal(NATURES.Adamant.up, 'atk');
  });

  test('creatures start with their four newest moves', () => {
    const mon = createMon('flarehound', 30, { rng: rng() });
    assert(mon.moves.length > 0 && mon.moves.length <= 4);
    const expected = defaultMovesFor('flarehound', 30);
    equal(mon.moves.length, expected.length);
  });

  test('experience curves are monotonic', () => {
    for (const curve of ['fast', 'medium', 'mediumslow', 'slow']) {
      let last = -1;
      for (let level = 1; level <= 100; level++) {
        const value = expForLevel(curve, level);
        assert(value >= last, `${curve} went backwards at level ${level}`);
        last = value;
      }
      equal(levelFromExp(curve, expForLevel(curve, 42)), 42, `${curve} round trip failed`);
    }
  });

  test('gaining experience levels a creature up', () => {
    const mon = createMon('nibbet', 5, { rng: rng() });
    const before = mon.stats.hp;
    const result = gainExp(mon, 20000);
    assert(result.levels.length > 0, 'expected at least one level');
    assert(mon.level > 5);
    assert(mon.stats.hp > before, 'levelling should raise max HP');
  });

  test('current HP rises with max HP on level up', () => {
    const mon = createMon('nibbet', 5, { rng: rng() });
    mon.hp = 5;
    const before = { hp: mon.hp, max: mon.stats.hp };
    gainExp(mon, 30000);
    equal(mon.hp - before.hp, mon.stats.hp - before.max, 'HP gain should match max HP gain');
  });

  test('exp award scales with the defeated level', () => {
    const weak = createMon('nibbet', 5, { rng: rng() });
    const strong = createMon('nibbet', 40, { rng: rng() });
    assert(expAward(strong, 20) > expAward(weak, 20));
    assert(expAward(weak, 20, { trainer: true }) > expAward(weak, 20));
  });

  test('training values are capped', () => {
    const mon = createMon('nibbet', 50, { rng: rng() });
    addTraining(mon, 'atk', 400);
    equal(mon.evs.atk, 252, 'per-stat cap');
    addTraining(mon, 'def', 400);
    const total = Object.values(mon.evs).reduce((a, b) => a + b, 0);
    assert(total <= MAX_TRAINING_TOTAL, `total training ${total} exceeded the cap`);
  });

  test('training raises the final stat', () => {
    const plain = createMon('nibbet', 50, { rng: rng(), ivs: allIvs(0), nature: 'Hardy' });
    const trained = createMon('nibbet', 50, { rng: rng(), ivs: allIvs(0), nature: 'Hardy' });
    addTraining(trained, 'atk', 252);
    assert(trained.stats.atk > plain.stats.atk, 'training should show up in the stat');
  });

  test('healing restores HP, status and PP', () => {
    const mon = createMon('emberkit', 20, { rng: rng() });
    mon.hp = 1;
    mon.status = 'burn';
    mon.moves[0].pp = 0;
    healFully(mon);
    equal(mon.hp, mon.stats.hp);
    equal(mon.status, null);
    assert(mon.moves[0].pp > 0);
  });

  test('moves can be taught within the four-slot limit', () => {
    const mon = createMon('emberkit', 40, {
      rng: rng(),
      moves: ['tackle', 'ember', 'growl', 'harden'],
    });
    equal(mon.moves.length, 4);
    assert(!teachMove(mon, 'ember'), 'a known move should be refused');
    assert(teachMove(mon, 'flamethrower', 0), 'replacing a slot should work');
    equal(mon.moves[0].id, 'flamethrower');
    equal(mon.moves.length, 4);
    equal(mon.moves[0].pp, mon.moves[0].maxPp, 'a fresh move comes with full PP');
  });

  test('tome compatibility follows type and learnset', () => {
    assert(canLearnMove('emberkit', 'flamethrower'), 'Ember types should learn Ember tomes');
    assert(canLearnMove('emberkit', 'rest'), 'universal moves are always allowed');
    assert(!canLearnMove('emberkit', 'watercannon'), 'off-type tomes should be refused');
  });
});

group('evolution', () => {
  test('level evolutions trigger at the right level', () => {
    const mon = createMon('emberkit', 16, { rng: rng() });
    equal(checkEvolution(mon, { trigger: 'level' }), null, 'too early');
    mon.level = 17;
    const evo = checkEvolution(mon, { trigger: 'level' });
    assert(evo && evo.to === 'flarehound', 'Emberkit should become Flarehound at 17');
  });

  test('branching evolutions respect their condition', () => {
    const physical = createMon('flarehound', 36, { rng: rng(), nature: 'Adamant', ivs: allIvs(0) });
    const special = createMon('flarehound', 36, { rng: rng(), nature: 'Modest', ivs: allIvs(0) });
    const a = checkEvolution(physical, { trigger: 'level' });
    const b = checkEvolution(special, { trigger: 'level' });
    equal(a.to, 'pyrelord');
    equal(b.to, 'cinderwraith');
  });

  test('time-of-day evolutions split correctly', () => {
    const day = createMon('brookend', 36, { rng: rng() });
    const night = createMon('brookend', 36, { rng: rng() });
    equal(checkEvolution(day, { trigger: 'level', isNight: false }).to, 'tidewarden');
    equal(checkEvolution(night, { trigger: 'level', isNight: true }).to, 'drownbell');
  });

  test('item evolutions need the right item', () => {
    const mon = createMon('menhir', 40, { rng: rng() });
    equal(checkEvolution(mon, { trigger: 'item', item: 'dawn_stone' }), null);
    const evo = checkEvolution(mon, { trigger: 'item', item: 'iron_core' });
    assert(evo && evo.to === 'forgewright');
  });

  test('friendship evolutions need affection', () => {
    const mon = createMon('cogitant', 40, { rng: rng(), friendship: 40 });
    equal(checkEvolution(mon, { trigger: 'level' }), null);
    mon.friendship = 220;
    const evo = checkEvolution(mon, { trigger: 'level' });
    assert(evo && evo.to === 'aetherseer');
  });

  test('evolving keeps level and HP ratio and grows stats', () => {
    const mon = createMon('emberkit', 20, { rng: rng() });
    mon.hp = Math.floor(mon.stats.hp / 2);
    const beforeStats = mon.stats.hp;
    const result = evolveMon(mon, 'flarehound');
    equal(mon.species, 'flarehound');
    equal(mon.level, 20);
    assert(mon.stats.hp > beforeStats, 'evolving should raise stats');
    near(mon.hp / mon.stats.hp, 0.5, 0.06, 'HP ratio should carry over');
    assert(Array.isArray(result.newMoves));
  });
});

group('capture', () => {
  test('a hurt, sleeping creature is easier to catch', () => {
    const mon = createWild('nibbet', 10, rng());
    const healthy = captureChance(mon, 1, {});
    mon.hp = 1;
    const hurt = captureChance(mon, 1, {});
    const asleep = captureChance(mon, 1, { statusBonus: 2.5 });
    assert(hurt > healthy, 'low HP should help');
    assert(asleep > hurt, 'sleep should help');
  });

  test('better orbs catch more often', () => {
    const roll = (mult) => {
      const r = new RNG(4242);
      let caught = 0;
      for (let i = 0; i < 400; i++) {
        const mon = createWild('nibbet', 10, new RNG(i));
        mon.hp = Math.floor(mon.stats.hp * 0.4);
        if (attemptCapture(mon, mult, r, {}).caught) caught++;
      }
      return caught;
    };
    const plain = roll(1);
    const ultra = roll(2);
    assert(ultra > plain, `ultra orbs (${ultra}) should beat plain orbs (${plain})`);
  });

  test('the Sovereign Orb never fails', () => {
    const mon = createWild('helion', 60, rng());
    equal(captureChance(mon, 255, {}), 1);
    equal(attemptCapture(mon, 255, rng(), {}).caught, true);
  });

  test('legendaries resist ordinary orbs', () => {
    const legend = createWild('noctra', 60, rng());
    const common = createWild('nibbet', 10, rng());
    assert(captureChance(legend, 1, {}) < captureChance(common, 1, {}) / 4);
  });

  test('status bonuses are graded', () => {
    const mon = createWild('nibbet', 10, rng());
    mon.status = 'sleep';
    equal(statusCaptureBonus(mon), 2.5);
    mon.status = 'burn';
    equal(statusCaptureBonus(mon), 1.5);
    mon.status = null;
    equal(statusCaptureBonus(mon), 1);
  });
});

group('bag and economy', () => {
  test('buying and selling move money the right way', () => {
    const bag = new Bag(1000);
    equal(bag.buy('potion', 3), 3, 'should afford three salves');
    equal(bag.money, 1000 - 600);
    equal(bag.count('potion'), 3);
    const gained = bag.sell('potion', 2);
    equal(gained, 200);
    equal(bag.count('potion'), 1);
  });

  test('you cannot overspend', () => {
    const bag = new Bag(150);
    equal(bag.buy('potion', 5), 0, 'nothing affordable');
    equal(bag.money, 150);
  });

  test('key items cannot be sold', () => {
    const bag = new Bag(0);
    bag.add('dex', 1);
    equal(bag.sell('dex', 1), 0);
    equal(bag.count('dex'), 1);
  });

  test('items land in the right pockets', () => {
    const bag = new Bag(0);
    bag.add('orb', 1);
    bag.add('potion', 1);
    bag.add('nugget', 1);
    bag.add('leftovers', 1);
    assert(bag.pocket('capture').includes('orb'));
    assert(bag.pocket('medicine').includes('potion'));
    assert(bag.pocket('treasure').includes('nugget'));
    assert(bag.pocket('held').includes('leftovers'));
  });

  test('treasure is worth selling', () => {
    const bag = new Bag(0);
    bag.add('nugget', 2);
    equal(bag.sell('nugget', 2), 10000);
  });
});

group('party and storage', () => {
  test('the party caps at six and overflow goes to storage', () => {
    const game = new Game({ playerName: 'Test', seed: 5 });
    for (let i = 0; i < PARTY_MAX; i++) {
      game.receiveMon(createMon('nibbet', 5, { rng: rng() }));
    }
    equal(game.party.length, PARTY_MAX);
    const placement = game.receiveMon(createMon('nibbet', 5, { rng: rng() }));
    equal(placement.where, 'storage');
    equal(game.storage.count(), 1);
  });

  test('storage boxes fill in order', () => {
    const storage = new Storage();
    for (let i = 0; i < 31; i++) storage.deposit(createMon('nibbet', 5, { rng: rng() }));
    equal(storage.boxes[0].mons.length, 30);
    equal(storage.boxes[1].mons.length, 1);
    equal(storage.count(), 31);
  });

  test('the party knows who can still fight', () => {
    const party = new Party([createMon('nibbet', 5, { rng: rng() }), createMon('flittle', 5, { rng: rng() })]);
    party.mons[0].hp = 0;
    equal(party.healthy().length, 1);
    equal(party.lead(), party.mons[1]);
    party.mons[1].hp = 0;
    assert(party.isWiped());
  });
});

group('quests', () => {
  test('flags advance quests and pay rewards', () => {
    const game = new Game({ playerName: 'Test', seed: 3 });
    game.quests.start('side_first_catch');
    const before = game.bag.money;
    assert(game.quests.isActive('side_first_catch'));
    game.setFlag('first_catch');
    assert(game.quests.isComplete('side_first_catch'));
    assert(game.bag.money > before, 'quest reward should be paid');
    assert(game.bag.has('greatorb'), 'reward items should arrive');
  });

  test('finishing a chapter starts the next one', () => {
    const game = new Game({ playerName: 'Test', seed: 3 });
    game.quests.start('ch1_first_light');
    game.setFlag('met_aldrin');
    game.setFlag('chose_starter');
    game.setFlag('entered_route1');
    assert(game.quests.isComplete('ch1_first_light'));
    assert(game.quests.isActive('ch2_grove'), 'chapter 2 should open');
  });

  test('dex milestones fire their own flags', () => {
    const game = new Game({ playerName: 'Test', seed: 3 });
    const ids = Object.keys(DEX).slice(0, 50);
    for (const id of ids) game.recordCaught(id);
    assert(game.getFlag('dex_50'), 'fifty caught should set the milestone');
  });
});

group('field items', () => {
  test('salves heal and are consumed', () => {
    const game = new Game({ playerName: 'Test', seed: 8 });
    const mon = createMon('emberkit', 20, { rng: rng() });
    mon.hp = 1;
    game.receiveMon(mon);
    game.bag.add('potion', 1);
    const result = game.useItem('potion', 0);
    assert(result.ok, result.message);
    equal(mon.hp, Math.min(mon.stats.hp, 31));
    equal(game.bag.count('potion'), 0);
  });

  test('revives only work on fainted creatures', () => {
    const game = new Game({ playerName: 'Test', seed: 8 });
    const mon = createMon('emberkit', 20, { rng: rng() });
    game.receiveMon(mon);
    game.bag.add('revive', 2);
    assert(!game.useItem('revive', 0).ok, 'should refuse a healthy creature');
    mon.hp = 0;
    assert(game.useItem('revive', 0).ok);
    assert(mon.hp > 0);
  });

  test('evolution stones return an evolution', () => {
    const game = new Game({ playerName: 'Test', seed: 8 });
    const mon = createMon('menhir', 40, { rng: rng() });
    game.receiveMon(mon);
    game.bag.add('iron_core', 1);
    const result = game.useItem('iron_core', 0);
    assert(result.evolution, 'expected an evolution');
    equal(result.evolution.evo.to, 'forgewright');
    game.applyEvolution(result.evolution.mon, result.evolution.evo);
    equal(mon.species, 'forgewright');
  });

  test('sunburst sweets add exactly one level', () => {
    const game = new Game({ playerName: 'Test', seed: 8 });
    const mon = createMon('nibbet', 10, { rng: rng() });
    game.receiveMon(mon);
    game.bag.add('rarecandy', 1);
    const result = game.useItem('rarecandy', 0);
    assert(result.ok, result.message);
    equal(mon.level, 11);
  });

  test('ward incense sets a step counter', () => {
    const game = new Game({ playerName: 'Test', seed: 8 });
    game.bag.add('repel', 1);
    assert(game.useItem('repel').ok);
    equal(game.repelSteps, 200);
    game.step();
    equal(game.repelSteps, 199);
  });
});

group('save files', () => {
  test('a game survives a round trip', () => {
    const game = new Game({ playerName: 'Rowan', seed: 11 });
    game.receiveMon(createMon('emberkit', 12, { rng: rng() }));
    game.receiveMon(createMon('flittle', 9, { rng: rng() }));
    game.party.mons[0].nickname = 'Sparks';
    game.party.mons[0].hp -= 4;
    game.bag.add('orb', 7);
    game.bag.earn(500);
    game.setFlag('met_aldrin');
    game.mapId = 'route1';
    game.x = 12;
    game.y = 8;
    game.playTime = 640;

    const revived = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    equal(revived.playerName, 'Rowan');
    equal(revived.party.length, 2);
    equal(revived.party.mons[0].nickname, 'Sparks');
    equal(revived.party.mons[0].hp, game.party.mons[0].hp);
    equal(revived.party.mons[0].stats.atk, game.party.mons[0].stats.atk);
    equal(revived.bag.count('orb'), 7);
    equal(revived.bag.money, game.bag.money);
    equal(revived.getFlag('met_aldrin'), true);
    equal(revived.mapId, 'route1');
    equal(revived.playTime, 640);
  });

  test('an in-memory storage provider works for save and load', () => {
    const fake = {
      data: {},
      getItem(k) {
        return this.data[k] || null;
      },
      setItem(k, v) {
        this.data[k] = v;
      },
      removeItem(k) {
        delete this.data[k];
      },
    };
    const game = new Game({ playerName: 'Ash', seed: 2 });
    game.receiveMon(createMon('puddlet', 7, { rng: rng() }));
    assert(game.save(fake));
    assert(Game.hasSave(fake));
    const loaded = Game.load(fake);
    equal(loaded.playerName, 'Ash');
    equal(loaded.party.length, 1);
    Game.clearSave(fake);
    assert(!Game.hasSave(fake));
  });

  test('rehydrating drops species that no longer exist', () => {
    const mon = createMon('emberkit', 10, { rng: rng() });
    mon.species = 'not_a_real_species';
    equal(rehydrateMon(mon), null);
  });
});

group('time of day', () => {
  test('the clock advances and flips to night', () => {
    const game = new Game({ playerName: 'Test', seed: 1 });
    game.clock = 12 * 60;
    assert(!game.isNight);
    game.clock = 22 * 60;
    assert(game.isNight);
    const before = game.clock;
    game.tick(60);
    assert(game.clock !== before, 'time should pass');
  });
});

group('encounters', () => {
  test('route tables produce creatures at sensible levels', () => {
    const map = prepareMap('route1');
    const pool = encounterPool(map, 'grass');
    assert(pool.entries.length > 5, 'route 1 should have a varied table');
    const r = new RNG(77);
    for (let i = 0; i < 50; i++) {
      const mon = rollEncounter(map, 'grass', r);
      assert(mon, 'encounter should produce a creature');
      assert(mon.level >= 3 && mon.level <= 7, `level ${mon.level} out of band`);
      assert(!getSpecies(mon.species).legendary, 'legendaries should not appear on route 1');
    }
  });

  test('habitat tables pull in the procedural roster', () => {
    const map = prepareMap('copper_quarry');
    const pool = encounterPool(map, 'cave');
    const generated = pool.entries.filter((e) => DEX[e.species].generated);
    assert(generated.length > 0, 'generated species should appear in caves');
  });
});

group('trainers', () => {
  test('teams build from species and habitat entries', () => {
    const team = buildTrainerTeam({
      name: 'Test Trainer',
      team: [
        { species: 'emberkit', level: 12 },
        { habitat: 'forest', level: 14 },
      ],
    });
    equal(team.length, 2);
    equal(team[0].species, 'emberkit');
    equal(team[0].level, 12);
    assert(team[1].moves.length > 0, 'habitat picks still get moves');
  });

  test('the same trainer always brings the same team', () => {
    const spec = { name: 'Repeatable', team: [{ habitat: 'cave', level: 20 }] };
    equal(buildTrainerTeam(spec)[0].species, buildTrainerTeam(spec)[0].species);
  });
});

function allIvs(value) {
  return { hp: value, atk: value, def: value, spa: value, spd: value, spe: value };
}
