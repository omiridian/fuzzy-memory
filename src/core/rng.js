// Deterministic, seedable RNG. Everything in the game that rolls dice goes
// through one of these so that a save file replays identically and the
// procedural creature roster is stable across machines.

const UINT32 = 0x100000000;

/** mulberry32 — small, fast, good enough distribution for a game. */
export class RNG {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** Float in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    if (max === undefined) {
      max = min - 1;
      min = 0;
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  float(min, max) {
    return min + this.next() * (max - min);
  }

  /** True with probability p (0..1). */
  chance(p) {
    return this.next() < p;
  }

  /** Roll a percentage, e.g. percent(30) is true 30% of the time. */
  percent(p) {
    return this.next() * 100 < p;
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** Pick `count` distinct entries (or as many as exist). */
  sample(list, count) {
    const pool = list.slice();
    const out = [];
    while (out.length < count && pool.length) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    }
    return out;
  }

  /** Weighted pick. `weights` maps 1:1 onto `list`. */
  weighted(list, weights) {
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.next() * total;
    for (let i = 0; i < list.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  serialize() {
    return { seed: this.seed, state: this.state };
  }

  static deserialize(data) {
    const rng = new RNG(data.seed);
    rng.state = data.state >>> 0;
    return rng;
  }
}

/** Stable string hash → 32-bit unsigned. Used to seed per-name generators. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** An RNG seeded purely by a name — same name, same numbers, forever. */
export function rngFromString(str) {
  return new RNG(hashString(str));
}

/** The global, unseeded-by-design roller for UI flourishes. */
export const cosmetic = new RNG(Math.floor(Math.random() * UINT32));
