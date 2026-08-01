// Small helpers shared across systems. Kept dependency-free so the test
// runner can import any module under Node without a DOM.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Title-cases an id like "razor_leaf" → "Razor Leaf". */
export function titleize(id) {
  return String(id)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Pads a number for the dex display: 7 → "#007". */
export function dexNumber(n) {
  return '#' + String(n).padStart(3, '0');
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Deep clone for plain data (no Dates/Maps in save payloads). */
export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** Sum of a numeric object's values. */
export function sumValues(obj) {
  let total = 0;
  for (const k in obj) total += obj[k];
  return total;
}

/** Wraps text to `width` characters, respecting explicit newlines. */
export function wrapText(text, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      if (!line.length) {
        line = word;
      } else if (line.length + 1 + word.length <= width) {
        line += ' ' + word;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line.length) lines.push(line);
  }
  return lines;
}

/** Formats 12345 → "12,345". */
export function formatMoney(n) {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Turns seconds into H:MM. */
export function formatPlayTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Joins a list into "a, b and c". */
export function listPhrase(items) {
  if (items.length <= 1) return items[0] || '';
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

/** Ensures `obj[key]` exists, creating it with `factory` if not. */
export function ensure(obj, key, factory) {
  if (!(key in obj)) obj[key] = factory();
  return obj[key];
}

/** Stable sort by a numeric key, descending. */
export function sortByDesc(list, keyFn) {
  return list
    .map((v, i) => [v, i])
    .sort((a, b) => keyFn(b[0]) - keyFn(a[0]) || a[1] - b[1])
    .map(([v]) => v);
}
