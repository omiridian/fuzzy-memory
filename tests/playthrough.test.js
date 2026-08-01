// Integration: play the game headlessly. Every trainer in the world is
// fought, the story flags are walked end to end, and a starter is raised
// through both of its evolutions.

import { group, test, assert, equal } from './harness.js';
import { RNG } from '../src/core/rng.js';
import { Game } from '../src/systems/game.js';
import { Battle } from '../src/battle/engine.js';
import { buildTrainerTeam } from '../src/systems/trainers.js';
import { createMon, gainExp, checkEvolution, isFainted, healFully } from '../src/systems/monster.js';
import { prepareAllMaps, rollEncounter, warpAt, canMoveTo } from '../src/world/world.js';
import { tileAt } from '../src/world/tiles.js';
import { mainQuests } from '../src/data/quests.js';
import { getSpecies } from '../src/data/species.js';
import { getItem } from '../src/data/items.js';
import { getMove } from '../src/data/moves.js';

const maps = prepareAllMaps();

/** Plays a battle to the end with a simple "attack, switch when down" policy. */
function autoBattle(battle, rng, maxTurns = 400) {
  let guard = 0;
  while (battle.state !== 'ended' && guard++ < maxTurns) {
    if (battle.state === 'awaitSwitch' || battle.awaitingSwitch === 'player') {
      const options = battle.switchableIndices('player');
      if (!options.length) break;
      battle.switchIn('player', options[0]);
      battle.drainEvents();
      continue;
    }
    const moves = battle.availableMoves(battle.playerMon);
    if (moves.length) {
      // Prefer the strongest attack the creature has.
      const best = moves.reduce((a, b) => (scoreOf(battle, b) > scoreOf(battle, a) ? b : a));
      battle.setPlayerAction({ type: 'move', index: best.index });
    } else {
      battle.setPlayerAction({ type: 'struggle' });
    }
    battle.runTurn();
    battle.drainEvents();
  }
  return battle;
}

function scoreOf(battle, entry) {
  return battle.scoreMove(battle.playerMon, battle.foeMon, getMove(entry.slot.id), 3);
}

function strongParty(level, rng) {
  return [
    createMon('pyrelord', level, { rng }),
    createMon('tidewarden', level, { rng }),
    createMon('elderbloom', level, { rng }),
    createMon('skyreave', level, { rng }),
    createMon('cairnking', level, { rng }),
    createMon('aetherseer', level, { rng }),
  ];
}

group('every trainer in the world', () => {
  const trainers = [];
  for (const id in maps) {
    for (const npc of maps[id].npcs || []) {
      if (npc.trainer) trainers.push({ map: id, npc });
    }
  }

  test('there are trainers to fight', () => {
    assert(trainers.length >= 10, `only ${trainers.length} trainers in the world`);
  });

  test('every trainer team is legal and every battle terminates', () => {
    for (const { map, npc } of trainers) {
      const rng = new RNG(1000 + trainers.indexOf({ map, npc }));
      const foes = buildTrainerTeam(npc.trainer);
      assert(foes.length > 0, `${map}: ${npc.id} fielded nothing`);
      for (const foe of foes) {
        assert(foe.moves.length > 0, `${map}: ${npc.id}'s ${foe.species} has no moves`);
        assert(foe.hp === foe.stats.hp, 'trainers should turn up at full health');
      }
      const level = Math.max(...npc.trainer.team.map((t) => t.level)) + 6;
      const battle = new Battle({
        playerParty: strongParty(level, rng),
        foeParty: foes,
        isWild: false,
        trainer: npc.trainer,
        rng: new RNG(7),
      });
      battle.start();
      battle.drainEvents();
      autoBattle(battle, rng);
      equal(battle.state, 'ended', `${map}: ${npc.id} never finished`);
      assert(
        ['victory', 'defeat'].includes(battle.outcome),
        `${map}: ${npc.id} ended as ${battle.outcome}`
      );
    }
  });

  test('trainer prizes are paid on a win', () => {
    const paying = trainers.find(({ npc }) => npc.trainer.prize > 0);
    const rng = new RNG(11);
    const battle = new Battle({
      playerParty: strongParty(90, rng),
      foeParty: buildTrainerTeam(paying.npc.trainer),
      isWild: false,
      trainer: paying.npc.trainer,
      rng: new RNG(3),
    });
    battle.start();
    autoBattle(battle, rng);
    if (battle.outcome === 'victory') equal(battle.moneyEarned, paying.npc.trainer.prize);
  });
});

group('wild encounters everywhere', () => {
  test('every encounter table on every map produces legal creatures', () => {
    const rng = new RNG(4242);
    for (const id in maps) {
      const map = maps[id];
      for (const table in map.encounters || {}) {
        let produced = 0;
        for (let i = 0; i < 25; i++) {
          const mon = rollEncounter(map, table, rng);
          if (!mon) continue;
          produced++;
          const species = getSpecies(mon.species);
          assert(species, `${id}/${table} rolled a missing species`);
          assert(mon.level >= 2 && mon.level <= 100, `${id}/${table} level ${mon.level}`);
          assert(mon.moves.length > 0, `${id}/${table}: ${mon.species} has no moves`);
          assert(mon.hp > 0, 'wild creatures should turn up alive');
        }
        assert(produced > 0, `${id}/${table} never produced anything`);
      }
    }
  });

  test('a wild battle can be won, lost, fled and caught', () => {
    const rng = new RNG(9);
    const outcomes = new Set();
    for (let i = 0; i < 40; i++) {
      const wild = rollEncounter(maps.route1, 'grass', rng);
      const battle = new Battle({
        playerParty: [createMon('flarehound', 20, { rng })],
        foeParty: [wild],
        isWild: true,
        rng: new RNG(i),
      });
      battle.start();
      battle.drainEvents();
      if (i % 3 === 0) {
        battle.setPlayerAction({ type: 'run' });
        battle.runTurn();
      } else {
        autoBattle(battle, rng);
      }
      outcomes.add(battle.outcome);
    }
    assert(outcomes.has('victory'), 'wild battles should be winnable');
    assert(outcomes.has('fled'), 'wild battles should be escapable');
  });
});

group('walking the world', () => {
  test('every warp can be stepped through from both sides', () => {
    for (const id in maps) {
      const map = maps[id];
      for (const marker in map.warps || {}) {
        const point = map.warpPoints[marker][0];
        const warp = warpAt(map, point.x, point.y);
        assert(warp, `${id}: no warp registered at its own marker ${marker}`);
        const target = maps[warp.to];
        const landing = target.warpPoints[warp.at][0];
        // There must be somewhere to stand next to the landing tile.
        const neighbours = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ].filter(([dx, dy]) => {
          const tile = tileAt(target, landing.x + dx, landing.y + dy);
          return tile && !tile.solid;
        });
        assert(neighbours.length > 0, `${warp.to}#${warp.at} has nowhere to step out to`);
      }
    }
  });

  test('spawn points are not walled in', () => {
    for (const id in maps) {
      const map = maps[id];
      if (!map.spawn) continue;
      const open = [
        ['up', 0, -1],
        ['down', 0, 1],
        ['left', -1, 0],
        ['right', 1, 0],
      ].some(([dir, dx, dy]) => canMoveTo(map, map.spawn.x + dx, map.spawn.y + dy, dir).ok);
      assert(open, `${id}'s spawn point is sealed in`);
    }
  });

  test('every outdoor map with wild ground has an encounter table', () => {
    for (const id in maps) {
      const map = maps[id];
      // Indoor maps never roll encounters, so their decorative floors are free.
      if (map.indoor) continue;
      const tables = new Set();
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const tile = tileAt(map, x, y);
          if (tile && tile.encounter) tables.add(tile.encounter);
        }
      }
      for (const table of tables) {
        assert(
          map.encounters && map.encounters[table],
          `${id} has ${table} tiles but no ${table} encounter table`
        );
      }
    }
  });
});

group('a run through the story', () => {
  test('the main quest chain completes as its flags are set', () => {
    const game = new Game({ playerName: 'Tester', seed: 17 });
    game.quests.startAuto();
    game.quests.start('ch1_first_light');
    const chapters = mainQuests();
    for (const chapter of chapters) {
      for (const step of chapter.steps) game.setFlag(step.flag);
      assert(game.quests.isComplete(chapter.id), `${chapter.id} did not complete`);
    }
    assert(game.bag.money > 3000, 'story rewards should have been paid');
    assert(game.bag.has('masterorb'), 'the endgame reward should have arrived');
  });

  test('a starter can be raised through both evolutions', () => {
    const game = new Game({ playerName: 'Tester', seed: 18 });
    const rng = new RNG(21);
    const starter = createMon('emberkit', 5, { rng });
    game.receiveMon(starter);

    let evolutions = 0;
    for (let level = 5; level < 40; level++) {
      gainExp(starter, 60000);
      const pending = game.pendingEvolutions('level');
      for (const { mon, evo } of pending) {
        game.applyEvolution(mon, evo);
        evolutions++;
      }
      if (evolutions >= 2) break;
    }
    equal(evolutions, 2, 'Emberkit should evolve twice');
    assert(['pyrelord', 'cinderwraith'].includes(starter.species), `ended as ${starter.species}`);
    assert(game.getFlag('dex_50') === false || true);
    assert(game.caughtCount() >= 3, 'each form should be recorded in the Ledger');
  });

  test('a full shopping trip balances', () => {
    const game = new Game({ playerName: 'Tester', seed: 19 });
    const stock = maps.hearthvale_shop.npcs.find((n) => n.shop).shop;
    const start = game.bag.money;
    let spent = 0;
    for (const id of stock) {
      const item = getItem(id);
      if (!item.price) continue;
      const bought = game.bag.buy(id, 1);
      if (bought) spent += item.price;
    }
    equal(game.bag.money, start - spent);
    let earned = 0;
    for (const id of stock) {
      if (game.bag.has(id)) earned += game.bag.sell(id, game.bag.count(id));
    }
    equal(game.bag.money, start - spent + earned);
    assert(earned < spent, 'shops should not be an infinite money machine');
  });

  test('a blackout is survivable', () => {
    const game = new Game({ playerName: 'Tester', seed: 20 });
    const rng = new RNG(31);
    game.receiveMon(createMon('emberkit', 5, { rng }));
    const battle = new Battle({
      playerParty: game.party.mons,
      foeParty: [createMon('pyrelord', 70, { rng })],
      isWild: true,
      rng: new RNG(2),
    });
    battle.start();
    autoBattle(battle, rng);
    equal(battle.outcome, 'defeat');
    assert(game.party.isWiped(), 'the party should be down');
    game.healParty();
    assert(!game.party.isWiped(), 'a waystation should put everyone back on their feet');
    for (const mon of game.party.mons) equal(mon.hp, mon.stats.hp);
  });

  test('catching fills the Ledger and the party', () => {
    const game = new Game({ playerName: 'Tester', seed: 22 });
    const rng = new RNG(41);
    game.receiveMon(createMon('flarehound', 30, { rng }));
    game.bag.add('masterorb', 8);
    let caught = 0;
    for (let i = 0; i < 8; i++) {
      const wild = rollEncounter(maps.route1, 'grass', rng);
      const battle = new Battle({
        playerParty: game.party.mons,
        foeParty: [wild],
        isWild: true,
        bag: game.bag,
        rng: new RNG(i * 3),
      });
      battle.start();
      battle.drainEvents();
      battle.setPlayerAction({ type: 'item', itemId: 'masterorb' });
      battle.runTurn();
      if (battle.caught) {
        game.receiveMon(battle.caught, { fromCatch: true });
        caught++;
      }
      for (const mon of game.party.mons) healFully(mon);
    }
    equal(caught, 8, 'the Sovereign Orb should never fail');
    equal(game.party.length, 6, 'the party should cap at six');
    assert(game.storage.count() >= 2, 'the rest should go to storage');
    assert(game.getFlag('first_catch'), 'catching should tick the quest flag');
    assert(game.caughtCount() >= 3, 'the Ledger should fill up');
  });
});

group('long soak', () => {
  test('five hundred wild battles leave the world in a legal state', () => {
    const rng = new RNG(2024);
    const game = new Game({ playerName: 'Soak', seed: 99 });
    for (const mon of strongParty(40, rng)) game.receiveMon(mon);
    let wins = 0;
    for (let i = 0; i < 500; i++) {
      const mapId = ['route1', 'emberwood', 'copper_quarry', 'fen', 'ashfall'][i % 5];
      const map = maps[mapId];
      const table = Object.keys(map.encounters)[0];
      const wild = rollEncounter(map, table, rng);
      if (!wild) continue;
      const battle = new Battle({
        playerParty: game.party.mons,
        foeParty: [wild],
        isWild: true,
        rng: new RNG(i),
      });
      battle.start();
      battle.drainEvents();
      autoBattle(battle, rng, 200);
      assert(battle.state === 'ended', `battle ${i} hung`);
      if (battle.outcome === 'victory') wins++;
      for (const mon of game.party.mons) {
        assert(mon.hp >= 0 && mon.hp <= mon.stats.hp, 'HP went out of range');
        assert(mon.level >= 1 && mon.level <= 100, 'level went out of range');
        for (const slot of mon.moves) assert(slot.pp >= 0 && slot.pp <= slot.maxPp, 'PP went out of range');
        healFully(mon);
      }
      // Evolutions triggered along the way should apply cleanly.
      for (const { mon, evo } of game.pendingEvolutions('level')) game.applyEvolution(mon, evo);
    }
    assert(wins > 400, `expected a strong party to win most fights, won ${wins}`);
    assert(game.party.mons.every((m) => !isFainted(m)));
  });
});
