import { assert, atLeast, equal, group, test } from './harness.js';
import { AudioEngine, midiToFreq } from '../src/audio/engine.js';
import { SFX, SFX_NAMES, playSound } from '../src/audio/sfx.js';
import { MODES, MusicDirector, BIOME_MODE, modeForBiomes } from '../src/audio/music.js';
import { AudioDirector, soundForEvent } from '../src/audio/director.js';
import { ABILITIES, CLASS_LIST } from '../src/data/classes.js';
import { Expedition } from '../src/systems/expedition.js';
import { createAdventurer } from '../src/systems/actors.js';
import { RNG } from '../src/core/rng.js';
import { STARTER_CARDS, rotateDoors } from '../src/data/cards.js';
import { legalCells } from '../src/systems/grid.js';

group('audio: silence is never an error', () => {
  test('the engine reports itself unavailable with no Web Audio', () => {
    const engine = new AudioEngine();
    equal(engine.available, false);
    equal(engine.unlock(), false);
    equal(engine.now(), 0);
  });

  test('every voice is a no-op rather than a crash', () => {
    const engine = new AudioEngine();
    equal(engine.tone({ freq: 440 }), null);
    equal(engine.noise({ freq: 800 }), null);
    equal(engine.drone({ freq: 60 }), null);
    engine.chord([60, 64, 67]);
    engine.release(null);
    engine.setMuted(true);
    engine.setVolume(0.2);
  });

  test('playing a sound with nothing to play it on just says no', () => {
    const engine = new AudioEngine();
    equal(playSound(engine, 'hit_melee'), false);
    equal(playSound(engine, 'no_such_sound'), false);
    equal(playSound(null, 'hit_melee'), false);
  });

  test('the director survives a whole run with no audio context', () => {
    const director = new AudioDirector();
    equal(director.available, false);
    director.setScene('expedition');
    for (const name of ['attack', 'hurt', 'kill', 'loot', 'biome', 'finish', 'nonsense']) {
      director.event(name, { kind: 'melee', outcome: 'wiped' });
    }
    director.update(0.016, null);
    equal(director.toggle(), false);
    equal(director.toggle(), true);
  });
});

group('audio: the sound bank', () => {
  test('there is a decent spread of sounds and each is playable', () => {
    atLeast(SFX_NAMES.length, 25);
    for (const name of SFX_NAMES) {
      assert(typeof SFX[name].play === 'function', `${name} has a recipe`);
    }
  });

  test('every event the game can raise names a sound that exists', () => {
    const events = [
      ['attack', { kind: 'melee' }], ['attack', { kind: 'arrow' }], ['attack', { kind: 'bolt' }],
      ['attack', { kind: 'ember' }], ['attack', { crit: true }], ['attack', {}],
      ['hurt', {}], ['heal', {}], ['flee', {}], ['trap', {}], ['level', {}],
      ['kill', { side: 'foe' }], ['kill', { side: 'foe', elite: true }], ['kill', { boss: true }],
      ['kill', { side: 'party' }],
      ['loot', {}], ['loot', { gear: true }],
      ['room_enter', {}], ['room_clear', {}], ['biome', {}], ['boss_intro', {}], ['threat_band', {}],
      ['card', { action: 'place' }], ['card', { action: 'draw' }], ['card', { action: 'rotate' }],
      ['card', { action: 'reject' }], ['card', { action: 'throw' }], ['card', {}],
      ['finish', { outcome: 'extracted' }], ['finish', { outcome: 'victory' }],
      ['finish', { outcome: 'wiped' }], ['finish', { outcome: 'timeout' }], ['finish', {}],
    ];
    for (const [name, data] of events) {
      const sound = soundForEvent(name, data);
      assert(sound, `${name} ${JSON.stringify(data)} names something`);
      assert(SFX[sound], `${name} names the missing sound "${sound}"`);
    }
  });

  test('every class ability has a sound', () => {
    for (const cls of CLASS_LIST) {
      for (const id of cls.abilities) {
        const sound = soundForEvent('ability', { id });
        assert(SFX[sound], `${id} names the missing sound "${sound}"`);
      }
    }
    for (const id of Object.keys(ABILITIES)) {
      assert(SFX[soundForEvent('ability', { id })], `${id} has a sound`);
    }
  });

  test('an unknown event asks for nothing at all', () => {
    equal(soundForEvent('the_dungeon_sighs'), null);
  });
});

group('audio: the score follows the run', () => {
  test('a busier dungeon plays faster', () => {
    const music = new MusicDirector(new AudioEngine());
    music.setTrack('expedition');
    const calm = music.bpm;
    music.setState({ threat: 90 });
    assert(music.bpm > calm, 'Threat picks up the tempo');
    music.setState({ boss: true });
    assert(music.bpm > calm + 10, 'and a boss picks it up further');
  });

  test('each scene has its own piece', () => {
    const music = new MusicDirector(new AudioEngine());
    music.setTrack('title');
    const title = music.bpm;
    music.setTrack('guild');
    assert(music.bpm !== title, 'the guild hall is not the title screen');
  });

  test('the biome you are standing in picks the mode', () => {
    equal(modeForBiomes({ undead: 4, holy: 1 }), 'phrygian');
    equal(modeForBiomes({ holy: 3 }), 'lydian');
    equal(modeForBiomes({}), 'aeolian');
    for (const mode of Object.values(BIOME_MODE)) assert(MODES[mode], `${mode} is a real mode`);
  });

  test('notes stay in the chosen scale', () => {
    const music = new MusicDirector(new AudioEngine());
    music.setState({ mode: 'phrygian' });
    const scale = MODES.phrygian;
    for (let degree = 0; degree < 14; degree++) {
      const semitone = ((music.note(degree, 1) % 12) + 12) % 12;
      const root = ((music.note(0, 1) % 12) + 12) % 12;
      const interval = ((semitone - root) + 12) % 12;
      assert(scale.includes(interval), `degree ${degree} landed outside the mode`);
    }
  });

  test('scheduling without a clock does nothing and does not spin', () => {
    const music = new MusicDirector(new AudioEngine());
    music.setTrack('expedition');
    music.update();
    equal(music.step, 0);
  });

  test('midi numbers convert to the right pitches', () => {
    equal(Math.round(midiToFreq(69)), 440);
    equal(Math.round(midiToFreq(57)), 220);
  });
});

group('audio: the simulation actually raises events', () => {
  test('a run emits the events the sound bank is listening for', () => {
    const rng = new RNG(4242);
    const roster = ['fighter', 'rogue', 'mage', 'cleric'].map((c) => createAdventurer(rng, { classId: c }));
    const deck = STARTER_CARDS.concat(['monster_den', 'crypt', 'treasure_vault', 'trapped_gallery']);
    const exp = new Expedition({ rng, roster, deckCards: deck, guild: {} });

    const seen = new Map();
    exp.onEvent = (name, data) => {
      seen.set(name, (seen.get(name) || 0) + 1);
      // Whatever the game raises, the bank must be able to answer.
      const sound = soundForEvent(name, data);
      if (sound) assert(SFX[sound], `${name} named the missing sound "${sound}"`);
    };

    const dt = 1 / 30;
    for (let step = 0; step < 30 * 240; step++) {
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
      exp.update(dt);
      if (exp.outcome) break;
    }
    if (!exp.outcome) exp.finish('timeout');

    for (const expected of ['card', 'room_enter', 'attack', 'kill', 'threat_band', 'finish']) {
      atLeast(seen.get(expected) || 0, 1, `the run raised "${expected}"`);
    }
  });

  test('an expedition with nobody listening behaves identically', () => {
    const run = (listen) => {
      const rng = new RNG(7);
      const roster = ['fighter', 'cleric'].map((c) => createAdventurer(rng, { classId: c }));
      const exp = new Expedition({ rng, roster, deckCards: STARTER_CARDS.slice(), guild: {} });
      if (listen) exp.onEvent = () => {};
      exp.dungeon.place('crypt', 0, -1, 0);
      exp.graphVersion += 1;
      for (let i = 0; i < 30 * 30; i++) exp.update(1 / 30);
      return { threat: Math.round(exp.threat.value), rooms: exp.dungeon.rooms.size, kills: exp.kills };
    };
    equal(JSON.stringify(run(false)), JSON.stringify(run(true)));
  });
});
