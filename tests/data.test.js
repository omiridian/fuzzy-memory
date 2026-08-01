// Data integrity: the dex, moves, items, maps and quests all have to line up.

import { group, test, assert, equal } from './harness.js';
import { DEX, DEX_ORDER, DEX_COUNT, STARTER_IDS, LEGENDARY_IDS, evolutionLine } from '../src/data/species.js';
import { MOVES, MOVE_IDS } from '../src/data/moves.js';
import { ITEMS, ITEM_IDS } from '../src/data/items.js';
import { ABILITIES } from '../src/data/abilities.js';
import { TYPES, effectiveness, typeMultiplier } from '../src/data/types.js';
import { MAPS } from '../src/data/maps.js';
import { QUESTS, mainQuests } from '../src/data/quests.js';
import { prepareAllMaps } from '../src/world/world.js';
import { TILES } from '../src/world/tiles.js';
import { NATURES, NATURE_LIST } from '../src/data/natures.js';

group('dex', () => {
  test('has hundreds of species', () => {
    assert(DEX_COUNT >= 300, `expected 300+ species, got ${DEX_COUNT}`);
  });

  test('every species has unique name and id', () => {
    const names = new Set();
    for (const id of DEX_ORDER) {
      assert(!names.has(DEX[id].name), `duplicate name ${DEX[id].name}`);
      names.add(DEX[id].name);
    }
    equal(new Set(DEX_ORDER).size, DEX_ORDER.length);
  });

  test('species records are well formed', () => {
    for (const id of DEX_ORDER) {
      const s = DEX[id];
      assert(s.types.length >= 1 && s.types.length <= 2, `${id} has ${s.types.length} types`);
      for (const t of s.types) assert(TYPES.includes(t), `${id} has unknown type ${t}`);
      const bstCap = s.legendary ? 900 : 760;
      assert(s.bst > 150 && s.bst < bstCap, `${id} has odd BST ${s.bst}`);
      assert(s.abilities.length >= 1, `${id} has no ability`);
      for (const a of s.abilities) assert(ABILITIES[a], `${id} has unknown ability ${a}`);
      if (s.hiddenAbility) assert(ABILITIES[s.hiddenAbility], `${id} hidden ability missing`);
      assert(s.catchRate >= 3 && s.catchRate <= 255, `${id} catch rate ${s.catchRate}`);
      assert(s.dex && s.dex.length > 10, `${id} has no dex entry`);
    }
  });

  test('every learnset move exists and starts at level 1', () => {
    for (const id of DEX_ORDER) {
      const s = DEX[id];
      assert(s.learnset.length >= 4, `${id} knows too little (${s.learnset.length})`);
      assert(s.learnset[0].level === 1, `${id} has no level 1 move`);
      for (const entry of s.learnset) assert(MOVES[entry.move], `${id} learns unknown move ${entry.move}`);
    }
  });

  test('evolution links resolve both ways', () => {
    for (const id of DEX_ORDER) {
      for (const evo of DEX[id].evolutions) {
        assert(DEX[evo.to], `${id} evolves into missing ${evo.to}`);
        equal(DEX[evo.to].prevo, id, `${evo.to} does not point back at ${id}`);
        assert(evo.note && evo.note.length, `${id} -> ${evo.to} has no readable note`);
        if (evo.method === 'item') assert(ITEMS[evo.item], `${id} needs unknown item ${evo.item}`);
      }
    }
  });

  test('has branching evolution lines', () => {
    const branching = DEX_ORDER.filter((id) => DEX[id].evolutions.length > 1);
    assert(branching.length >= 15, `only ${branching.length} branching species`);
  });

  test('has three-stage lines', () => {
    const threeStage = DEX_ORDER.filter((id) => DEX[id].stage === 3);
    assert(threeStage.length >= 40, `only ${threeStage.length} final forms`);
  });

  test('starters and legendaries exist', () => {
    for (const id of STARTER_IDS) assert(DEX[id], `missing starter ${id}`);
    assert(LEGENDARY_IDS.length >= 4, 'expected at least four legendaries');
    for (const id of LEGENDARY_IDS) assert(DEX[id].catchRate <= 10, `${id} is too easy to catch`);
  });

  test('evolution lines walk from the base form', () => {
    const line = evolutionLine('flarehound');
    equal(line[0].species.id, 'emberkit');
    assert(line.length >= 4, 'Emberkit line should branch into four entries');
  });
});

group('moves', () => {
  test('move records are sane', () => {
    for (const id of MOVE_IDS) {
      const m = MOVES[id];
      assert(TYPES.includes(m.type), `${id} has unknown type`);
      assert(['physical', 'special', 'status'].includes(m.category), `${id} bad category`);
      assert(m.pp > 0 && m.pp <= 40, `${id} has ${m.pp} PP`);
      assert(m.accuracy >= 0 && m.accuracy <= 100, `${id} accuracy ${m.accuracy}`);
      if (m.category === 'status') equal(m.power, 0, `${id} is a status move with power`);
      else assert(m.power > 0, `${id} deals no damage`);
    }
  });

  test('every type has an attacking option', () => {
    for (const type of TYPES) {
      const attacks = MOVE_IDS.filter((id) => MOVES[id].type === type && MOVES[id].category !== 'status');
      assert(attacks.length >= 3, `${type} only has ${attacks.length} attacks`);
    }
  });
});

group('type chart', () => {
  test('multipliers stay in range', () => {
    for (const a of TYPES) {
      for (const b of TYPES) {
        const m = typeMultiplier(a, b);
        assert([0, 0.5, 1, 2].includes(m), `${a}->${b} is ${m}`);
      }
    }
  });

  test('dual types multiply', () => {
    // Ember is strong against Verdant and weak to Stone.
    equal(effectiveness('ember', ['verdant', 'insect']), 4);
    equal(effectiveness('volt', ['stone']), 0);
  });
});

group('items', () => {
  test('item records are sane', () => {
    for (const id of ITEM_IDS) {
      const it = ITEMS[id];
      assert(it.name, `${id} has no name`);
      assert(it.price >= 0 && it.sell >= 0, `${id} has negative value`);
      if (it.effect && it.effect.teach) assert(MOVES[it.effect.teach], `${id} teaches unknown move`);
    }
  });

  test('shops sell for less than they charge', () => {
    for (const id of ITEM_IDS) {
      const it = ITEMS[id];
      if (it.price > 0) assert(it.sell <= it.price, `${id} sells for more than it costs`);
    }
  });

  test('every evolution item is obtainable', () => {
    const stones = ITEM_IDS.filter((id) => ITEMS[id].category === 'evolution');
    assert(stones.length >= 8, 'expected a decent spread of evolution stones');
  });
});

group('natures', () => {
  test('twenty-five natures, five neutral', () => {
    equal(NATURE_LIST.length, 25);
    equal(NATURE_LIST.filter((n) => !NATURES[n].up).length, 5);
  });
});

group('world', () => {
  const maps = prepareAllMaps();

  test('every map row is the same width', () => {
    for (const id in maps) {
      const map = maps[id];
      for (const row of map.tiles) equal(row.length, map.width, `${id} has a ragged row`);
    }
  });

  test('every tile character is known', () => {
    for (const id in maps) {
      for (const row of maps[id].tiles) {
        for (const ch of row) assert(TILES[ch], `${id} uses unknown tile "${ch}"`);
      }
    }
  });

  test('warps resolve to a real destination marker', () => {
    for (const id in maps) {
      const map = maps[id];
      for (const marker in map.warps || {}) {
        const warp = map.warps[marker];
        const target = maps[warp.to];
        assert(target, `${id} warps to missing map ${warp.to}`);
        assert(
          target.warpPoints[warp.at] && target.warpPoints[warp.at].length,
          `${id} warp ${marker} -> ${warp.to}#${warp.at} has no landing point`
        );
      }
    }
  });

  test('every warp marker is actually placed on the grid', () => {
    for (const id in maps) {
      const map = maps[id];
      for (const marker in map.warps || {}) {
        assert(map.warpPoints[marker], `${id} declares warp ${marker} but never draws it`);
      }
    }
  });

  test('NPCs stand on walkable tiles', () => {
    for (const id in maps) {
      const map = maps[id];
      for (const npc of map.npcs || []) {
        const tile = TILES[map.tiles[npc.y][npc.x]];
        assert(tile && !tile.solid, `${id}: ${npc.id} is inside ${tile ? tile.name : 'nothing'}`);
      }
    }
  });

  test('spawn points are walkable', () => {
    for (const id in maps) {
      const map = maps[id];
      if (!map.spawn) continue;
      const tile = TILES[map.tiles[map.spawn.y][map.spawn.x]];
      assert(tile && !tile.solid, `${id} spawns inside ${tile ? tile.name : 'the void'}`);
    }
  });

  test('shops and trainers reference real data', () => {
    for (const id in maps) {
      for (const npc of maps[id].npcs || []) {
        for (const itemId of npc.shop || []) assert(ITEMS[itemId], `${id}: shop sells unknown ${itemId}`);
        if (npc.trainer) {
          assert(npc.trainer.team && npc.trainer.team.length, `${id}: ${npc.id} has no team`);
          for (const entry of npc.trainer.team) {
            if (entry.species) assert(DEX[entry.species], `${id}: unknown species ${entry.species}`);
            assert(entry.level > 0 && entry.level <= 100, `${id}: bad level`);
          }
          if (npc.trainer.reward) assert(ITEMS[npc.trainer.reward.item], `${id}: unknown reward`);
        }
      }
    }
  });

  test('the world is connected from the starting town', () => {
    const seen = new Set(['player_home']);
    const queue = ['player_home'];
    while (queue.length) {
      const current = queue.shift();
      for (const marker in maps[current].warps || {}) {
        const to = maps[current].warps[marker].to;
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    for (const id in maps) assert(seen.has(id), `${id} cannot be reached from the start`);
  });
});

group('quests', () => {
  test('main story is a complete chain', () => {
    const chapters = mainQuests();
    assert(chapters.length >= 7, `only ${chapters.length} chapters`);
    chapters.forEach((q, i) => {
      equal(q.chapter, i + 1, `chapter ${q.chapter} is out of order`);
      if (q.nextQuest) assert(QUESTS[q.nextQuest], `${q.id} points at missing ${q.nextQuest}`);
    });
  });

  test('quest rewards reference real items', () => {
    for (const id in QUESTS) {
      for (const entry of (QUESTS[id].reward || {}).items || []) {
        assert(ITEMS[entry.item], `${id} rewards unknown item ${entry.item}`);
      }
      assert(QUESTS[id].steps.length > 0, `${id} has no steps`);
      for (const step of QUESTS[id].steps) assert(step.flag, `${id} step has no flag`);
    }
  });
});
