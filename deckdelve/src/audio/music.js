// The score, generated as it plays.
//
// There is no track to load and no loop to hear twice. A step scheduler walks a
// sixteenth-note grid and decides, bar by bar, what each layer should do — and
// the layers are wired to the game: Threat picks the tempo and how many of them
// are running, a fight brings in the drums, and the biome the party is standing
// in chooses the mode, so a crypt and a shrine genuinely sound different.

import { RNG } from '../core/rng.js';
import { midiToFreq } from './engine.js';

export const MODES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 3, 5, 7, 10],
};

/** What a biome does to the key. The Necropolis really is in Phrygian. */
export const BIOME_MODE = {
  undead: 'phrygian',
  holy: 'lydian',
  fire: 'harmonic',
  arcane: 'harmonic',
  nature: 'dorian',
  goblin: 'pentatonic',
  treasure: 'lydian',
  ancient: 'aeolian',
};

const LOOKAHEAD = 0.14; // seconds of notes scheduled ahead of the clock
const ROOT = 38; // D2

export class MusicDirector {
  constructor(engine) {
    this.engine = engine;
    this.rng = new RNG(1337);
    this.track = null;
    this.pending = null;
    this.step = 0;
    this.nextStepAt = 0;
    this.drone = null;
    this.state = { threat: 0, combat: false, boss: false, mode: 'aeolian', depth: 0 };
    this.intensity = 0;
  }

  get bpm() {
    if (this.track === 'title') return 54;
    if (this.track === 'guild') return 86;
    return 66 + this.state.threat * 0.18 + (this.state.boss ? 14 : 0);
  }

  get stepDuration() {
    return 60 / this.bpm / 4;
  }

  /** 'title' | 'guild' | 'expedition' | null. Safe to call before unlock. */
  setTrack(name) {
    if (this.track === name) return;
    this.pending = name;
    this.stopDrone();
    this.track = name;
    this.step = 0;
    this.nextStepAt = 0;
    this.rng = new RNG(name === 'expedition' ? Date.now() & 0xffff : 99);
  }

  setState(patch) {
    Object.assign(this.state, patch);
  }

  stopDrone() {
    if (this.drone && this.engine) {
      this.engine.release(this.drone, 1.2);
      this.drone = null;
    }
  }

  stop() {
    this.stopDrone();
    this.track = null;
  }

  scale() {
    return MODES[this.state.mode] || MODES.aeolian;
  }

  /** Picks a degree of the current mode, `octaves` above the root. */
  note(degree, octave = 0) {
    const scale = this.scale();
    const index = ((degree % scale.length) + scale.length) % scale.length;
    const wrap = Math.floor(degree / scale.length);
    return ROOT + scale[index] + (octave + wrap) * 12;
  }

  // -------------------------------------------------------------------------
  // The clock
  // -------------------------------------------------------------------------

  update() {
    const a = this.engine;
    if (!this.track || !a || !a.available) return;

    // Intensity eases behind the game so the mix does not flap.
    const want = Math.min(1, this.state.threat / 100 + (this.state.combat ? 0.25 : 0));
    this.intensity += (want - this.intensity) * 0.02;

    if (!this.drone && this.track !== 'guild') this.startDrone();
    this.shapeDrone();

    const now = a.now();
    if (!this.nextStepAt) this.nextStepAt = now + 0.05;
    let guard = 64;
    while (this.nextStepAt < now + LOOKAHEAD && guard-- > 0) {
      this.scheduleStep(this.step, this.nextStepAt);
      this.step = (this.step + 1) % 64;
      this.nextStepAt += this.stepDuration;
    }
  }

  startDrone() {
    const a = this.engine;
    if (!a || !a.available) return;
    this.drone = a.drone({
      freq: midiToFreq(ROOT - 12),
      gain: this.track === 'title' ? 0.05 : 0.07,
      cutoff: 260,
      attack: 3,
      detunes: [-6, 6, 0],
    });
  }

  /** Threat opens the drone up and pulls it out of tune. */
  shapeDrone() {
    if (!this.drone || !this.engine) return;
    const t = this.engine.now();
    const open = 220 + this.intensity * 520;
    try {
      this.drone.filter.frequency.setTargetAtTime(open, t, 1.5);
      const spread = 6 + this.intensity * 16;
      this.drone.oscillators.forEach((osc, i) => {
        const sign = i === 0 ? -1 : i === 1 ? 1 : 0;
        osc.detune.setTargetAtTime(sign * spread, t, 2);
      });
    } catch {
      /* the node went away mid-fade */
    }
  }

  scheduleStep(step, when) {
    if (this.track === 'title') return this.titleStep(step, when);
    if (this.track === 'guild') return this.guildStep(step, when);
    return this.expeditionStep(step, when);
  }

  // -------------------------------------------------------------------------
  // Tracks
  // -------------------------------------------------------------------------

  titleStep(step, when) {
    const a = this.engine;
    if (step % 32 === 0) {
      a.tone({ freq: midiToFreq(ROOT), type: 'triangle', dur: 3, gain: 0.05, time: when, space: 0.6 });
    }
    if (step % 8 === 0 && this.rng.chance(0.6)) {
      const degree = this.rng.pick([0, 2, 4, 5, 6]);
      a.tone({
        freq: midiToFreq(this.note(degree, 2)),
        type: 'sine',
        dur: 2.4,
        gain: 0.045,
        attack: 0.3,
        time: when,
        space: 0.85,
      });
    }
  }

  guildStep(step, when) {
    const a = this.engine;
    const bar = step % 16;
    if (bar === 0 || bar === 8) {
      a.tone({
        freq: midiToFreq(ROOT + (bar === 8 ? 5 : 0)),
        type: 'triangle',
        dur: 0.7,
        gain: 0.07,
        time: when,
        filter: 'lowpass',
        cutoff: 700,
      });
    }
    // A plucked figure over the top — warm, and not in the least triumphant.
    if (bar % 3 === 0) {
      const degree = [0, 2, 4, 2, 5, 4][(step / 3 | 0) % 6];
      a.tone({
        freq: midiToFreq(this.note(degree, 2)),
        type: 'triangle',
        dur: 0.5,
        gain: 0.045,
        attack: 0.008,
        time: when,
        space: 0.45,
      });
    }
  }

  expeditionStep(step, when) {
    const a = this.engine;
    const bar = step % 16;
    const threat = this.state.threat;

    // Always: a limping bass pulse. It is the dungeon's pulse, not the party's.
    if (bar === 0 || bar === 10) {
      a.tone({
        freq: midiToFreq(ROOT - 12 + (bar === 10 ? 3 : 0)),
        type: 'sine',
        dur: 0.9,
        gain: 0.1,
        time: when,
      });
    }

    // Stirring: a slow modal line starts picking its way over the drone.
    if (threat >= 18 && bar % 4 === 0 && this.rng.chance(0.55)) {
      const degree = this.rng.pick([0, 1, 2, 4, 5, 6]);
      a.tone({
        freq: midiToFreq(this.note(degree, 2)),
        type: 'triangle',
        dur: 1.4,
        gain: 0.05,
        attack: 0.08,
        time: when,
        space: 0.7,
      });
    }

    // Roused: something starts keeping time, and it speeds up with the Threat.
    if (threat >= 42) {
      const beats = threat >= 72 ? [0, 6, 8, 14] : [0, 8];
      if (beats.includes(bar)) {
        a.noise({
          freq: 150,
          freqTo: 52,
          dur: 0.24,
          gain: 0.1,
          filter: 'lowpass',
          q: 1.5,
          time: when,
        });
      }
    }

    // Furious: a high, sour shimmer. The tritone is deliberate.
    if (threat >= 68 && bar === 4 && this.rng.chance(0.4)) {
      a.tone({
        freq: midiToFreq(ROOT + 18 + 12),
        type: 'sine',
        dur: 2.2,
        gain: 0.03,
        attack: 0.6,
        time: when,
        space: 0.9,
      });
    }

    // A fight in the room brings the drums up.
    if (this.state.combat && bar % 4 === 2) {
      a.noise({ freq: 420, freqTo: 110, dur: 0.13, gain: 0.06, filter: 'lowpass', time: when });
    }
    if (this.state.combat && bar === 0) {
      a.tone({
        freq: midiToFreq(ROOT - 12),
        type: 'sawtooth',
        dur: 0.5,
        gain: 0.07,
        filter: 'lowpass',
        cutoff: 600,
        cutoffTo: 180,
        time: when,
      });
    }

    // A boss gets a motif of its own, three notes, over and over, closing in.
    if (this.state.boss && (bar === 0 || bar === 2 || bar === 5)) {
      const degree = bar === 0 ? 0 : bar === 2 ? 1 : 4;
      a.tone({
        freq: midiToFreq(this.note(degree, 1)),
        type: 'sawtooth',
        dur: 0.42,
        gain: 0.075,
        filter: 'lowpass',
        cutoff: 1100,
        cutoffTo: 300,
        time: when,
        space: 0.4,
      });
    }
  }
}

/** The mode a dungeon is in, from whichever biome tag is most represented. */
export function modeForBiomes(tagCounts) {
  let best = null;
  let bestCount = 0;
  for (const tag in tagCounts) {
    if (tagCounts[tag] > bestCount && BIOME_MODE[tag]) {
      bestCount = tagCounts[tag];
      best = tag;
    }
  }
  return best ? BIOME_MODE[best] : 'aeolian';
}
