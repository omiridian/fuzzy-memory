// Small helpers shared across the game. Dependency-free so the test runner can
// import any system under Node without a canvas anywhere in sight.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Moves `a` toward `b` by at most `step`. */
export function approach(a, b, step) {
  if (a < b) return Math.min(a + step, b);
  return Math.max(a - step, b);
}

export const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

/** Title-cases an id like "mushroom_cave" → "Mushroom Cave". */
export function titleize(id) {
  return String(id)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Deep clone for plain data — save payloads hold nothing exotic. */
export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** Wraps text to `width` characters, respecting explicit newlines. */
export function wrapText(input, width) {
  const lines = [];
  for (const paragraph of String(input).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (!line.length) line = word;
      else if (line.length + 1 + word.length <= width) line += ' ' + word;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** 91 → "1:31". Used for the expedition clock. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "3 goblins" / "1 goblin". */
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}

/** Joins a list the way a person would: "a, b and c". */
export function listWords(words) {
  const w = words.filter(Boolean);
  if (w.length <= 1) return w[0] || '';
  return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
}

let idCounter = 0;
/** Process-unique handle, so actors can reference each other without cycles. */
export function uid(prefix = 'id') {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

/** Resets the uid counter. Tests use it to keep ids readable. */
export function resetUid() {
  idCounter = 0;
}
