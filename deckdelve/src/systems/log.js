// The chronicle. Every expedition writes one, and it is where the stories live:
// who opened what, who ran, who did not come back.

const MAX = 240;

export class Chronicle {
  constructor() {
    this.entries = [];
    this.serial = 0;
    this.dirty = true;
  }

  /** kind: 'plain' | 'good' | 'bad' | 'biome' | 'boss' | 'bark' | 'loot' | 'death' */
  write(text, kind = 'plain', meta = null) {
    this.serial += 1;
    const entry = { id: this.serial, text, kind, meta, age: 0 };
    this.entries.push(entry);
    if (this.entries.length > MAX) this.entries.shift();
    this.dirty = true;
    return entry;
  }

  tick(dt) {
    for (const e of this.entries) e.age += dt;
  }

  /** Newest first, for the on-screen feed. */
  recent(count = 8) {
    return this.entries.slice(-count).reverse();
  }

  clear() {
    this.entries.length = 0;
    this.dirty = true;
  }
}
