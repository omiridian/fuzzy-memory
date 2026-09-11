import { assert, atLeast, equal, group, test, throws } from './harness.js';
import { CARDS, CARD_BY_ID, ENTRANCE, STARTER_CARDS, TAGS, getCard } from '../src/data/cards.js';
import { BOSSES, ENEMIES, getEnemy } from '../src/data/enemies.js';
import { ABILITIES, CLASS_LIST, getAbility } from '../src/data/classes.js';
import { ROLLABLE_TRAITS, TRAITS } from '../src/data/traits.js';
import { GEAR, GRADE_ORDER, gearFor } from '../src/data/equipment.js';
import { BIOMES } from '../src/data/biomes.js';
import { EVENTS } from '../src/data/events.js';
import { GRADES, TREASURE_NAMES } from '../src/data/loot.js';
import { STATUS } from '../src/data/status.js';

const TAG_VALUES = Object.values(TAGS);

group('data: the prototype has what it promised', () => {
  test('fifteen to twenty-odd room cards', () => {
    atLeast(CARDS.length, 15);
  });

  test('four playable classes plus one to unlock', () => {
    equal(CLASS_LIST.filter((c) => !c.locked).length, 4);
    atLeast(CLASS_LIST.filter((c) => c.locked).length, 1);
  });

  test('five to eight ordinary enemy types', () => {
    atLeast(Object.keys(ENEMIES).length, 5);
    assert(Object.keys(ENEMIES).length <= 10, 'the prototype stays small');
  });

  test('exactly one mini-boss and one final boss', () => {
    equal(Object.keys(BOSSES).length, 2);
    assert(BOSSES.grumwick && BOSSES.cindervex);
  });

  test('a starter deck the guild can actually field', () => {
    atLeast(STARTER_CARDS.length, 10);
    for (const id of STARTER_CARDS) assert(CARD_BY_ID[id], `${id} is a real card`);
  });
});

group('data: cards are internally consistent', () => {
  test('every card has doors, a name and a blurb', () => {
    for (const card of CARDS) {
      assert(card.doors > 0, `${card.id} has at least one door`);
      assert(card.name && card.blurb && card.discovery, `${card.id} is written`);
      assert(typeof card.threat === 'number', `${card.id} is priced in Threat`);
    }
  });

  test('every tag on a card is a known tag', () => {
    for (const card of CARDS) {
      for (const tag of card.tags) assert(TAG_VALUES.includes(tag), `${card.id}: unknown tag ${tag}`);
    }
  });

  test('every enemy a card can spawn exists', () => {
    for (const card of CARDS) {
      for (const spec of (card.contents && card.contents.enemies) || []) {
        assert(ENEMIES[spec.type], `${card.id} spawns unknown ${spec.type}`);
        assert(spec.count[0] <= spec.count[1], `${card.id} has a sane count range`);
      }
      if (card.contents && card.contents.boss) assert(BOSSES[card.contents.boss], `${card.id} boss exists`);
      if (card.contents && card.contents.loot) {
        assert(GRADES[card.contents.loot.grade], `${card.id} loot grade exists`);
      }
    }
  });

  test('the entrance is a room with every door open', () => {
    equal(ENTRANCE.doors, 15);
    equal(ENTRANCE.contents.feature, 'exit');
  });

  test('getCard refuses to invent rooms', () => {
    throws(() => getCard('grand_ballroom'));
  });
});

group('data: monsters and abilities', () => {
  test('every enemy has the numbers combat needs', () => {
    for (const [id, e] of Object.entries({ ...ENEMIES, ...BOSSES })) {
      for (const field of ['hp', 'damage', 'attackRange', 'attackTime', 'speed', 'xp']) {
        assert(typeof e[field] === 'number' && e[field] > 0, `${id} is missing ${field}`);
      }
      assert(Array.isArray(e.gold), `${id} drops coin`);
      if (e.onHit) assert(STATUS[e.onHit.status], `${id} applies a real status`);
    }
  });

  test('every class ability is defined and triggerable', () => {
    for (const cls of CLASS_LIST) {
      for (const id of cls.abilities) {
        const ability = getAbility(id);
        assert(ability.cooldown > 0, `${id} has a cooldown`);
        assert(ability.trigger, `${id} knows when to fire`);
      }
    }
  });

  test('abilities that apply a status apply a real one', () => {
    for (const a of Object.values(ABILITIES)) {
      if (a.status) assert(STATUS[a.status], `${a.id} applies unknown ${a.status}`);
    }
  });

  test('boss abilities are complete', () => {
    for (const boss of Object.values(BOSSES)) {
      assert(boss.intro && boss.defeat, `${boss.id} has an entrance and an exit`);
      for (const a of boss.abilities) assert(a.cooldown > 0 && a.text, `${boss.id}: ${a.id}`);
    }
  });

  test('getEnemy refuses to invent monsters', () => {
    throws(() => getEnemy('tax_collector'));
  });
});

group('data: traits, gear, biomes, events', () => {
  test('traits are rollable and described', () => {
    atLeast(ROLLABLE_TRAITS.length, 10);
    for (const t of Object.values(TRAITS)) assert(t.name && t.blurb, `${t.id} is written`);
  });

  test('gear covers every slot at every grade the tables can roll', () => {
    for (const grade of GRADE_ORDER) {
      atLeast(gearFor(null, grade).length, 3);
    }
    for (const g of GEAR) assert(GRADE_ORDER.includes(g.grade), `${g.id} has a known grade`);
  });

  test('each class can find a weapon it is allowed to hold', () => {
    for (const cls of CLASS_LIST) {
      const weapons = gearFor(cls.id, 'superb').filter((g) => g.slot === 'weapon');
      atLeast(weapons.length, 1);
    }
  });

  test('biome recipes point at real cards, tags and monsters', () => {
    for (const b of BIOMES) {
      assert(b.announce && b.blurb, `${b.id} is written`);
      if (b.cards) for (const id of Object.keys(b.cards)) assert(CARD_BY_ID[id], `${b.id} needs ${id}`);
      if (b.tag) assert(TAG_VALUES.includes(b.tag), `${b.id} uses a real tag`);
      if (b.spawn) assert(ENEMIES[b.spawn.type], `${b.id} spawns a real monster`);
      assert(b.reward && b.reward.gold > 0, `${b.id} pays out`);
    }
  });

  test('every event outcome is weighted and written', () => {
    for (const e of Object.values(EVENTS)) {
      assert(e.text.includes('{who}'), `${e.id} names somebody`);
      atLeast(e.outcomes.length, 2);
      for (const o of e.outcomes) {
        assert(o.weight > 0 && o.text, `${e.id} outcome is complete`);
        if (o.status) assert(STATUS[o.status], `${e.id} applies a real status`);
        if (o.spawn) assert(ENEMIES[o.spawn], `${e.id} spawns a real monster`);
      }
    }
  });

  test('loot tables have a name pool for every grade', () => {
    for (const grade of Object.keys(GRADES)) atLeast((TREASURE_NAMES[grade] || []).length, 3);
  });
});
