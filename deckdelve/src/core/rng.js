// Deterministic, seedable RNG. Every roll in an expedition goes through one of
// these, so a seed replays the same dungeon, the same loot and the same
// unfortunate goblin ambush.

const UINT32 = 0x100000000;

/** mulberry32 — small, fast, and plenty even for a dungeon full of dice. */
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

  /** Integer in [min, max] inclusive. `int(n)` gives 0..n-1. */
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

  /** True with probability p, given as a fraction (0..1). */
  chance(p) {
    return this.next() < p;
  }

  /** True p percent of the time. */
  percent(p) {
    return this.next() * 100 < p;
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** Picks `count` distinct entries, or as many as the list holds. */
  sample(list, count) {
    const pool = list.slice();
    const out = [];
    while (out.length < count && pool.length) {
      out.push(pool.splice(this.int(pool.length), 1)[0]);
    }
    return out;
  }

  /** Fisher-Yates, in place, returning the same array for convenience. */
  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /** Picks from `[{ weight, ...}]`, falling back to the last entry. */
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e.weight || 0;
    let roll = this.next() * total;
    for (const e of entries) {
      roll -= e.weight || 0;
      if (roll <= 0) return e;
    }
    return entries[entries.length - 1];
  }

  /** A fresh independent stream, so one subsystem cannot desync another. */
  fork() {
    return new RNG(this.int(0, 0xffffffff));
  }
}
