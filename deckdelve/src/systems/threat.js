// Threat: the dungeon's attention span. It only ever goes up, and everything
// good you do pushes it there. The whole extract-or-delve-deeper decision hangs
// off this number.

export const THREAT_MAX = 100;

export const THREAT_BANDS = [
  { at: 0, name: 'Unnoticed', blurb: 'Nothing down here has looked up yet.' },
  { at: 20, name: 'Stirring', blurb: 'Something has started counting your footsteps.' },
  { at: 40, name: 'Roused', blurb: 'Doors you did not open are open.' },
  { at: 60, name: 'Hunting', blurb: 'It knows how many of you there are.' },
  { at: 80, name: 'Furious', blurb: 'Whatever is down here would like you to stay. Permanently.' },
];

export class Threat {
  constructor() {
    this.value = 0;
    this.drift = 0.07; // per second, because dawdling is also a choice
    this.recent = [];
    this.band = THREAT_BANDS[0];
    this.pulse = 0;
  }

  add(amount, reason) {
    if (amount <= 0) return;
    const before = this.value;
    this.value = Math.min(THREAT_MAX, this.value + amount);
    this.pulse = Math.min(1, this.pulse + amount * 0.06);
    if (reason) {
      this.recent.push({ amount, reason });
      if (this.recent.length > 6) this.recent.shift();
    }
    const bandBefore = bandFor(before);
    const bandNow = bandFor(this.value);
    this.band = bandNow;
    return bandNow !== bandBefore ? bandNow : null;
  }

  tick(dt, context = {}) {
    this.pulse = Math.max(0, this.pulse - dt * 0.8);
    const depth = context.depth || 0;
    return this.add(this.drift * dt * (1 + depth * 0.12), null);
  }

  /** Multipliers handed to the spawner and the loot tables. */
  get enemyScale() {
    return 1 + this.value * 0.011;
  }

  get lootScale() {
    return 1 + this.value * 0.009;
  }

  get fraction() {
    return this.value / THREAT_MAX;
  }
}

export function bandFor(value) {
  let out = THREAT_BANDS[0];
  for (const band of THREAT_BANDS) if (value >= band.at) out = band;
  return out;
}
