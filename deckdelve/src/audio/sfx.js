// The sound effects, as recipes rather than files. Each one is a few
// oscillators and a bit of filtered noise; the names are the game's own
// vocabulary, so the director can map an event straight onto one.

import { midiToFreq } from './engine.js';

/**
 * `throttle` is milliseconds during which a repeat of the same sound is
 * dropped, which matters because a fight at triple speed lands a lot of blows.
 */
export const SFX = {
  // --- interface ----------------------------------------------------------
  ui_tap: {
    throttle: 40,
    play: (a) => {
      a.noise({ freq: 2600, dur: 0.035, gain: 0.05, q: 3 });
    },
  },
  ui_select: {
    throttle: 40,
    play: (a) => {
      a.tone({ freq: midiToFreq(84), type: 'triangle', dur: 0.09, gain: 0.07, space: 0.15 });
    },
  },
  ui_deny: {
    throttle: 120,
    play: (a) => {
      a.tone({ freq: midiToFreq(50), type: 'square', dur: 0.12, gain: 0.06, sweepTo: midiToFreq(45) });
    },
  },

  // --- cards --------------------------------------------------------------
  card_draw: {
    throttle: 60,
    play: (a) => {
      a.noise({ freq: 3200, freqTo: 1400, dur: 0.13, gain: 0.06, filter: 'bandpass', q: 0.8 });
    },
  },
  card_rotate: {
    throttle: 60,
    play: (a) => {
      a.noise({ freq: 1800, freqTo: 2600, dur: 0.07, gain: 0.045, q: 2 });
    },
  },
  /** A slab of dungeon arriving: a woody thud, stone grinding, and dust. */
  card_place: {
    play: (a) => {
      const t = a.now();
      a.tone({ freq: 110, type: 'sine', dur: 0.3, gain: 0.28, sweepTo: 48, time: t });
      a.noise({ freq: 320, freqTo: 120, dur: 0.36, gain: 0.14, filter: 'lowpass', q: 1, time: t });
      a.noise({ freq: 5200, freqTo: 2200, dur: 0.5, gain: 0.04, filter: 'highpass', time: t + 0.05, space: 0.3 });
    },
  },

  // --- the dungeon --------------------------------------------------------
  room_enter: {
    throttle: 200,
    play: (a) => {
      const t = a.now();
      a.noise({ freq: 240, freqTo: 700, dur: 0.55, gain: 0.07, filter: 'lowpass', time: t, space: 0.5 });
      a.tone({ freq: midiToFreq(43), type: 'triangle', dur: 0.6, gain: 0.06, time: t, space: 0.4 });
    },
  },
  room_clear: {
    play: (a) => {
      a.chord([72, 76, 79], { type: 'triangle', dur: 0.5, gain: 0.06, stagger: 0.07, space: 0.5 });
    },
  },
  trap: {
    play: (a) => {
      const t = a.now();
      a.noise({ freq: 4200, freqTo: 900, dur: 0.16, gain: 0.16, q: 4, time: t });
      a.tone({ freq: 1400, type: 'square', dur: 0.1, gain: 0.07, sweepTo: 300, time: t });
    },
  },

  // --- blows --------------------------------------------------------------
  hit_melee: {
    throttle: 55,
    play: (a) => {
      const t = a.now();
      a.noise({ freq: 1700, freqTo: 420, dur: 0.1, gain: 0.13, q: 1.4, time: t });
      a.tone({ freq: 190, type: 'square', dur: 0.07, gain: 0.08, sweepTo: 70, time: t });
    },
  },
  hit_crit: {
    throttle: 70,
    play: (a) => {
      const t = a.now();
      a.noise({ freq: 2600, freqTo: 500, dur: 0.16, gain: 0.17, q: 1.2, time: t });
      a.tone({ freq: 320, type: 'square', dur: 0.12, gain: 0.1, sweepTo: 80, time: t });
      a.tone({ freq: midiToFreq(93), type: 'triangle', dur: 0.28, gain: 0.07, time: t + 0.02, space: 0.4 });
    },
  },
  hit_arrow: {
    throttle: 55,
    play: (a) => {
      a.noise({ freq: 900, freqTo: 3400, dur: 0.12, gain: 0.07, q: 2.5 });
    },
  },
  hit_magic: {
    throttle: 55,
    play: (a) => {
      const t = a.now();
      a.tone({ freq: 1100, type: 'sine', dur: 0.22, gain: 0.09, sweepTo: 260, time: t, space: 0.35 });
      a.tone({ freq: 1640, type: 'triangle', dur: 0.16, gain: 0.05, sweepTo: 420, time: t + 0.01 });
    },
  },
  hit_fire: {
    throttle: 70,
    play: (a) => {
      a.noise({ freq: 1400, freqTo: 260, dur: 0.3, gain: 0.1, filter: 'lowpass', q: 2, space: 0.25 });
    },
  },
  /** One of yours taking it: duller, closer, and always audible. */
  hurt: {
    throttle: 110,
    play: (a) => {
      const t = a.now();
      a.tone({ freq: 150, type: 'sine', dur: 0.16, gain: 0.13, sweepTo: 62, time: t });
      a.noise({ freq: 600, freqTo: 180, dur: 0.13, gain: 0.07, filter: 'lowpass', time: t });
    },
  },

  // --- mercies ------------------------------------------------------------
  heal: {
    throttle: 120,
    play: (a) => {
      a.chord([76, 83], { type: 'sine', dur: 0.5, gain: 0.07, stagger: 0.06, space: 0.5 });
    },
  },
  bless: {
    play: (a) => {
      a.chord([72, 76, 81, 84], { type: 'triangle', dur: 0.9, gain: 0.05, stagger: 0.05, space: 0.6 });
    },
  },

  // --- endings ------------------------------------------------------------
  enemy_die: {
    throttle: 70,
    play: (a) => {
      const t = a.now();
      a.noise({ freq: 800, freqTo: 130, dur: 0.24, gain: 0.1, filter: 'lowpass', time: t });
      a.tone({ freq: 220, type: 'sawtooth', dur: 0.2, gain: 0.06, sweepTo: 55, time: t });
    },
  },
  elite_die: {
    play: (a) => {
      const t = a.now();
      a.noise({ freq: 900, freqTo: 90, dur: 0.4, gain: 0.13, filter: 'lowpass', time: t, space: 0.3 });
      a.tone({ freq: 180, type: 'sawtooth', dur: 0.36, gain: 0.09, sweepTo: 42, time: t });
    },
  },
  boss_die: {
    play: (a) => {
      const t = a.now();
      a.tone({ freq: 160, type: 'sawtooth', dur: 2.2, gain: 0.16, sweepTo: 28, time: t, space: 0.6 });
      a.noise({ freq: 700, freqTo: 60, dur: 2.4, gain: 0.12, filter: 'lowpass', time: t, space: 0.5 });
      a.chord([48, 55, 60, 64], { type: 'triangle', dur: 2.4, gain: 0.05, stagger: 0.16, time: t + 0.5, space: 0.7 });
    },
  },
  /** Somebody's last moment. Low, and it takes its time. */
  adventurer_die: {
    play: (a) => {
      const t = a.now();
      a.tone({ freq: midiToFreq(45), type: 'sine', dur: 1.6, gain: 0.14, sweepTo: midiToFreq(33), time: t, space: 0.6 });
      a.tone({ freq: midiToFreq(69), type: 'triangle', dur: 2.2, gain: 0.06, time: t + 0.12, space: 0.8 });
      a.noise({ freq: 300, freqTo: 80, dur: 1.2, gain: 0.05, filter: 'lowpass', time: t });
    },
  },
  flee: {
    throttle: 800,
    play: (a) => {
      a.tone({ freq: midiToFreq(64), type: 'triangle', dur: 0.3, gain: 0.07, sweepTo: midiToFreq(59) });
    },
  },

  // --- reward -------------------------------------------------------------
  loot: {
    play: (a) => {
      const t = a.now();
      a.chord([79, 84, 88], { type: 'triangle', dur: 0.35, gain: 0.08, stagger: 0.05, time: t, space: 0.4 });
      a.noise({ freq: 5000, dur: 0.1, gain: 0.04, q: 2, time: t });
    },
  },
  gear: {
    play: (a) => {
      const t = a.now();
      a.noise({ freq: 3400, freqTo: 6000, dur: 0.3, gain: 0.05, q: 1.5, time: t, space: 0.5 });
      a.chord([76, 83, 88], { type: 'sine', dur: 0.6, gain: 0.06, stagger: 0.07, time: t, space: 0.6 });
    },
  },
  level_up: {
    play: (a) => {
      a.chord([72, 76, 79, 84], { type: 'triangle', dur: 0.6, gain: 0.08, stagger: 0.075, space: 0.5 });
    },
  },

  // --- the big moments ----------------------------------------------------
  /** Rooms combining. A swell, not a sting — it should feel like weather. */
  biome: {
    play: (a) => {
      const t = a.now();
      a.chord([36, 43, 48, 51, 55], {
        type: 'sawtooth', dur: 2.6, gain: 0.05, attack: 0.9, stagger: 0.1,
        filter: 'lowpass', cutoff: 300, cutoffTo: 1500, time: t, space: 0.7,
      });
      a.noise({ freq: 200, freqTo: 1800, dur: 2.2, gain: 0.05, filter: 'lowpass', attack: 1.2, time: t, space: 0.6 });
    },
  },
  boss_intro: {
    play: (a) => {
      const t = a.now();
      a.chord([33, 40, 45], {
        type: 'sawtooth', dur: 2.4, gain: 0.11, attack: 0.35,
        filter: 'lowpass', cutoff: 900, cutoffTo: 260, time: t, space: 0.5,
      });
      a.noise({ freq: 120, freqTo: 40, dur: 2.6, gain: 0.09, filter: 'lowpass', attack: 0.5, time: t });
    },
  },
  threat_band: {
    play: (a) => {
      const t = a.now();
      a.tone({ freq: midiToFreq(38), type: 'sawtooth', dur: 1.3, gain: 0.09, filter: 'lowpass', cutoff: 500, cutoffTo: 160, time: t, space: 0.5 });
      a.tone({ freq: midiToFreq(39), type: 'sine', dur: 1.5, gain: 0.05, time: t, space: 0.6 });
    },
  },

  // --- how it ends --------------------------------------------------------
  extract: {
    play: (a) => {
      a.chord([60, 64, 67, 72, 76], { type: 'triangle', dur: 1.6, gain: 0.07, stagger: 0.1, space: 0.7 });
    },
  },
  victory: {
    play: (a) => {
      const t = a.now();
      a.chord([48, 55, 60, 64, 67], { type: 'triangle', dur: 2.4, gain: 0.08, stagger: 0.11, time: t, space: 0.7 });
      a.chord([72, 76, 79, 84], { type: 'sine', dur: 2, gain: 0.06, stagger: 0.09, time: t + 0.7, space: 0.8 });
    },
  },
  wipe: {
    play: (a) => {
      const t = a.now();
      a.chord([48, 51, 55, 58], {
        type: 'sawtooth', dur: 3.2, gain: 0.07, attack: 0.4, stagger: 0.22,
        filter: 'lowpass', cutoff: 700, cutoffTo: 140, time: t, space: 0.7,
      });
      a.tone({ freq: midiToFreq(24), type: 'sine', dur: 3.4, gain: 0.1, time: t });
    },
  },
};

export function playSound(engine, name) {
  const recipe = SFX[name];
  if (!recipe || !engine || !engine.available) return false;
  if (recipe.throttle && !engine.throttle(name, recipe.throttle)) return false;
  try {
    recipe.play(engine);
  } catch {
    // A sound is never worth taking the game down for.
    return false;
  }
  return true;
}

export const SFX_NAMES = Object.keys(SFX);
