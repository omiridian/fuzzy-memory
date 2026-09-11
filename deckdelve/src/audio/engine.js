// The sound engine. Every note and every knock is synthesised at runtime —
// there is not a single audio file in the project, for the same reason there is
// not a single image: the whole thing stays one folder of text.
//
// Nothing here throws when there is no Web Audio to be had. Under Node, in a
// browser that refuses an AudioContext, or before the player has touched the
// screen, `available` is false and every call is a no-op.

const A4 = 440;

/** MIDI note number → hertz. 69 is A4. */
export function midiToFreq(note) {
  return A4 * Math.pow(2, (note - 69) / 12);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.blocked = false;
    this.muted = false;
    this.volume = 0.95;
    this.buses = {};
    this.lastPlayed = new Map();
  }

  get available() {
    return !!(this.ctx && this.ready && !this.muted);
  }

  /**
   * Builds the graph. Browsers only allow this from a user gesture, so it is
   * called from the first tap or click rather than at boot.
   */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.ready = this.ctx.state === 'running';
      return this.ready;
    }
    if (this.blocked) return false;
    const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) {
      this.blocked = true;
      return false;
    }
    try {
      this.ctx = new Ctor();
    } catch {
      this.blocked = true;
      return false;
    }
    this.buildGraph();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.ready = true;
    return true;
  }

  buildGraph() {
    const ctx = this.ctx;
    // A compressor on the end keeps a room full of skeletons from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(limiter);

    // One cheap feedback delay stands in for a stone room. Everything with a
    // sense of space is sent here rather than carrying its own reverb.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.26;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2200;
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    const spaceLevel = ctx.createGain();
    spaceLevel.gain.value = 0.5;
    delay.connect(spaceLevel);
    spaceLevel.connect(master);

    const sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);

    const music = ctx.createGain();
    music.gain.value = 0.62;
    music.connect(master);

    this.buses = { master, sfx, music, space: delay, limiter };
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.buses.master) {
      const target = this.muted ? 0 : this.volume;
      this.buses.master.gain.setTargetAtTime(target, this.now(), 0.05);
    }
    return this.muted;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.buses.master && !this.muted) {
      this.buses.master.gain.setTargetAtTime(this.volume, this.now(), 0.05);
    }
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  busFor(name) {
    return this.buses[name] || this.buses.sfx;
  }

  /**
   * Stops a sound retriggering faster than `ms`. A party of four at triple
   * speed lands a lot of sword blows, and four identical clicks in the same
   * frame is a click, not a sword.
   */
  throttle(key, ms) {
    const now = this.now();
    const last = this.lastPlayed.get(key);
    if (last !== undefined && (now - last) * 1000 < ms) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  // -------------------------------------------------------------------------
  // Voices
  // -------------------------------------------------------------------------

  /** One oscillator with an envelope. The workhorse. */
  tone(opts = {}) {
    if (!this.available) return null;
    const ctx = this.ctx;
    const t = opts.time || this.now();
    const dur = opts.dur === undefined ? 0.2 : opts.dur;
    const attack = opts.attack === undefined ? 0.005 : opts.attack;
    const peak = opts.gain === undefined ? 0.2 : opts.gain;

    const osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, opts.freq || 220), t);
    if (opts.sweepTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), t + dur * (opts.sweepAt || 1));
    }
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, t);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    let node = osc;
    if (opts.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filter;
      filter.frequency.setValueAtTime(opts.cutoff || 1200, t);
      if (opts.cutoffTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.cutoffTo), t + dur);
      filter.Q.value = opts.q === undefined ? 1 : opts.q;
      node.connect(filter);
      node = filter;
    }
    node.connect(env);
    env.connect(this.busFor(opts.bus));
    if (opts.space) {
      const send = ctx.createGain();
      send.gain.value = opts.space;
      env.connect(send);
      send.connect(this.buses.space);
    }

    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  /** Filtered noise: everything percussive, breathy or broken. */
  noise(opts = {}) {
    if (!this.available) return null;
    const ctx = this.ctx;
    const t = opts.time || this.now();
    const dur = opts.dur === undefined ? 0.15 : opts.dur;
    const peak = opts.gain === undefined ? 0.2 : opts.gain;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer();
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(Math.max(40, opts.freq || 1000), t);
    if (opts.freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqTo), t + dur);
    filter.Q.value = opts.q === undefined ? 1 : opts.q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + (opts.attack || 0.004));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    source.connect(filter);
    filter.connect(env);
    env.connect(this.busFor(opts.bus));
    if (opts.space) {
      const send = ctx.createGain();
      send.gain.value = opts.space;
      env.connect(send);
      send.connect(this.buses.space);
    }

    source.start(t);
    source.stop(t + dur + 0.05);
    return source;
  }

  /** Two seconds of white noise, made once and shared by every noise voice. */
  noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buffer;
    return buffer;
  }

  /** Several notes at once, or spread into an arpeggio with `stagger`. */
  chord(notes, opts = {}) {
    if (!this.available) return;
    const base = opts.time || this.now();
    notes.forEach((note, i) => {
      this.tone({
        ...opts,
        freq: typeof note === 'number' && note < 200 ? midiToFreq(note) : note,
        time: base + i * (opts.stagger || 0),
        gain: (opts.gain === undefined ? 0.15 : opts.gain) * (opts.fade ? 1 - i * 0.12 : 1),
      });
    });
  }

  /** A long, held layer the music owns and modulates. Returns its handles. */
  drone(opts = {}) {
    if (!this.available) return null;
    const ctx = this.ctx;
    const t = this.now();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain || 0.06), t + (opts.attack || 2));

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.cutoff || 400, t);
    filter.Q.value = 2;

    const oscillators = [];
    for (const detune of opts.detunes || [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = opts.type || 'sawtooth';
      osc.frequency.setValueAtTime(opts.freq || 73, t);
      osc.detune.setValueAtTime(detune, t);
      osc.connect(filter);
      osc.start(t);
      oscillators.push(osc);
    }
    filter.connect(gain);
    gain.connect(this.busFor(opts.bus || 'music'));

    const send = ctx.createGain();
    send.gain.value = 0.3;
    gain.connect(send);
    send.connect(this.buses.space);

    return { oscillators, filter, gain, send };
  }

  /** Fades a held layer out and lets it go. */
  release(handle, seconds = 1.5) {
    if (!handle || !this.ctx) return;
    const t = this.now();
    try {
      handle.gain.gain.cancelScheduledValues(t);
      handle.gain.gain.setValueAtTime(Math.max(0.0002, handle.gain.gain.value), t);
      handle.gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      for (const osc of handle.oscillators) osc.stop(t + seconds + 0.1);
    } catch {
      /* already stopped */
    }
  }
}
