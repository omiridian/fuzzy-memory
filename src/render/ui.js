// Shared drawing helpers: panels, text boxes, bars, type badges and a generic
// list menu that most of the game's screens are built from.

import { wrapText } from '../core/util.js';
import { typeColor, typeName } from '../data/types.js';
import { statusColor, statusShort } from '../battle/effects.js';

export const FONT = '"Courier New", ui-monospace, monospace';

export const COLORS = {
  panel: '#1d2230',
  panelLight: '#2b3346',
  border: '#e8e2d0',
  borderDark: '#0f131c',
  text: '#f2eee2',
  textDim: '#a8a49a',
  accent: '#f0b040',
  good: '#5fc86a',
  warn: '#e8c33c',
  bad: '#e05a4a',
  hpFull: '#5fc86a',
  hpMid: '#e8c33c',
  hpLow: '#e05a4a',
  exp: '#5fb0e0',
  shadow: 'rgba(0,0,0,0.45)',
};

export function setFont(ctx, size, weight = '') {
  ctx.font = `${weight} ${size}px ${FONT}`.trim();
  ctx.textBaseline = 'top';
}

/** A bordered panel in the game's house style. */
export function panel(ctx, x, y, w, h, opts = {}) {
  const radius = opts.radius !== undefined ? opts.radius : 6;
  ctx.save();
  ctx.fillStyle = opts.shadow === false ? 'transparent' : COLORS.shadow;
  if (opts.shadow !== false) roundRect(ctx, x + 3, y + 4, w, h, radius, true, false);
  ctx.fillStyle = opts.fill || COLORS.panel;
  roundRect(ctx, x, y, w, h, radius, true, false);
  ctx.strokeStyle = opts.border || COLORS.border;
  ctx.lineWidth = opts.lineWidth || 2;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, radius - 1, false, true);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

export function text(ctx, str, x, y, opts = {}) {
  setFont(ctx, opts.size || 14, opts.weight || '');
  ctx.fillStyle = opts.color || COLORS.text;
  ctx.textAlign = opts.align || 'left';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

/** Word-wrapped paragraph; returns the height used. */
export function paragraph(ctx, str, x, y, width, opts = {}) {
  const size = opts.size || 14;
  const lineHeight = opts.lineHeight || size + 6;
  const charWidth = size * 0.62;
  const lines = wrapText(str, Math.max(8, Math.floor(width / charWidth)));
  lines.forEach((line, i) => text(ctx, line, x, y + i * lineHeight, opts));
  return lines.length * lineHeight;
}

/** A labelled progress bar (HP, EXP, stat meters). */
export function bar(ctx, x, y, w, h, ratio, color, opts = {}) {
  ctx.save();
  ctx.fillStyle = opts.back || '#12161f';
  roundRect(ctx, x, y, w, h, h / 2, true, false);
  const filled = Math.max(0, Math.min(1, ratio)) * (w - 2);
  if (filled > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x + 1, y + 1, Math.max(2, filled), h - 2, (h - 2) / 2, true, false);
  }
  if (opts.border !== false) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, h / 2, false, true);
  }
  ctx.restore();
}

export function hpColor(ratio) {
  if (ratio > 0.5) return COLORS.hpFull;
  if (ratio > 0.2) return COLORS.hpMid;
  return COLORS.hpLow;
}

/** Small coloured chip showing an elemental type. */
export function typeBadge(ctx, type, x, y, opts = {}) {
  const w = opts.width || 54;
  const h = opts.height || 16;
  ctx.save();
  ctx.fillStyle = typeColor(type);
  roundRect(ctx, x, y, w, h, 4, true, false);
  ctx.fillStyle = '#12151c';
  setFont(ctx, opts.size || 10, 'bold');
  ctx.textAlign = 'center';
  ctx.fillText(typeName(type).toUpperCase(), x + w / 2, y + (h - (opts.size || 10)) / 2 + 1);
  ctx.restore();
  ctx.textAlign = 'left';
  return w;
}

export function statusBadge(ctx, status, x, y) {
  if (!status) return 0;
  ctx.save();
  ctx.fillStyle = statusColor(status);
  roundRect(ctx, x, y, 34, 15, 3, true, false);
  ctx.fillStyle = '#12151c';
  setFont(ctx, 10, 'bold');
  ctx.textAlign = 'center';
  ctx.fillText(statusShort(status), x + 17, y + 3);
  ctx.restore();
  ctx.textAlign = 'left';
  return 34;
}

/** The blinking "press to continue" arrow. */
export function continueArrow(ctx, x, y, time) {
  if (Math.floor(time * 2) % 2 === 0) return;
  ctx.save();
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 10, y);
  ctx.lineTo(x + 5, y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * A scrolling list menu. Screens own an instance and forward key presses.
 */
export class ListMenu {
  constructor(items, opts = {}) {
    this.setItems(items);
    this.index = 0;
    this.scroll = 0;
    this.visible = opts.visible || 6;
    this.columns = opts.columns || 1;
    this.onSelect = opts.onSelect || null;
    this.onCancel = opts.onCancel || null;
    this.onMove = opts.onMove || null;
    this.wrap = opts.wrap !== false;
  }

  setItems(items) {
    this.items = items || [];
    if (this.index >= this.items.length) this.index = Math.max(0, this.items.length - 1);
    this.clampScroll();
  }

  get current() {
    return this.items[this.index] || null;
  }

  clampScroll() {
    if (this.index < this.scroll) this.scroll = this.index;
    const rows = Math.ceil(this.visible);
    if (this.index >= this.scroll + rows) this.scroll = this.index - rows + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.items.length - rows)));
  }

  move(delta) {
    if (!this.items.length) return;
    let next = this.index + delta;
    if (this.wrap) {
      next = (next + this.items.length) % this.items.length;
    } else {
      next = Math.max(0, Math.min(this.items.length - 1, next));
    }
    if (next !== this.index) {
      this.index = next;
      this.clampScroll();
      if (this.onMove) this.onMove(this.current, this.index);
    }
  }

  handle(key) {
    switch (key) {
      case 'up':
        this.move(-this.columns);
        return true;
      case 'down':
        this.move(this.columns);
        return true;
      case 'left':
        if (this.columns > 1) this.move(-1);
        return true;
      case 'right':
        if (this.columns > 1) this.move(1);
        return true;
      case 'confirm':
        if (this.onSelect && this.current !== null) this.onSelect(this.current, this.index);
        return true;
      case 'cancel':
        if (this.onCancel) this.onCancel();
        return true;
      default:
        return false;
    }
  }

  /** Default renderer: one line per item, with a cursor. */
  render(ctx, x, y, w, opts = {}) {
    const lineHeight = opts.lineHeight || 22;
    const rows = Math.ceil(this.visible);
    const end = Math.min(this.items.length, this.scroll + rows);
    for (let i = this.scroll; i < end; i++) {
      const item = this.items[i];
      const yy = y + (i - this.scroll) * lineHeight;
      const selected = i === this.index;
      if (selected) {
        ctx.fillStyle = 'rgba(240,176,64,0.18)';
        roundRect(ctx, x - 4, yy - 3, w, lineHeight, 4, true, false);
        text(ctx, '>', x - 2, yy + 2, { color: COLORS.accent, size: opts.size || 14 });
      }
      const label = typeof item === 'string' ? item : item.label;
      const right = typeof item === 'object' && item.right ? item.right : null;
      const color = typeof item === 'object' && item.color ? item.color : selected ? COLORS.text : COLORS.textDim;
      text(ctx, label, x + 14, yy + 2, { color, size: opts.size || 14 });
      if (right) {
        text(ctx, right, x + w - 12, yy + 2, {
          color: typeof item === 'object' && item.rightColor ? item.rightColor : COLORS.textDim,
          size: opts.size || 14,
          align: 'right',
        });
      }
    }
    if (this.items.length > rows) {
      const trackY = y;
      const trackH = rows * lineHeight;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + w - 4, trackY, 3, trackH);
      const thumb = Math.max(12, (rows / this.items.length) * trackH);
      const offset = (this.scroll / Math.max(1, this.items.length - rows)) * (trackH - thumb);
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x + w - 4, trackY + offset, 3, thumb);
    }
  }
}

/** A queue-driven text box used for dialogue and battle messages. */
export class TextBox {
  constructor(opts = {}) {
    this.lines = [];
    this.queue = [];
    this.charIndex = 0;
    this.speed = opts.speed || 48; // characters per second
    this.done = true;
    this.width = opts.width || 60;
    this.onFinish = null;
    this.speaker = null;
  }

  say(textOrArray, opts = {}) {
    const items = Array.isArray(textOrArray) ? textOrArray : [textOrArray];
    for (const item of items) this.queue.push(typeof item === 'string' ? { text: item } : item);
    if (this.done) this.next();
    if (opts.onFinish) this.onFinish = opts.onFinish;
  }

  next() {
    const item = this.queue.shift();
    if (!item) {
      this.done = true;
      this.lines = [];
      const cb = this.onFinish;
      this.onFinish = null;
      if (cb) cb();
      return false;
    }
    this.lines = wrapText(item.text, this.width);
    this.speaker = item.speaker || null;
    this.charIndex = 0;
    this.done = false;
    return true;
  }

  get isTyping() {
    return !this.done && this.charIndex < this.totalChars;
  }

  get totalChars() {
    return this.lines.reduce((sum, line) => sum + line.length, 0);
  }

  get isBusy() {
    return !this.done || this.queue.length > 0;
  }

  update(dt) {
    if (this.done) return;
    this.charIndex = Math.min(this.totalChars, this.charIndex + this.speed * dt);
  }

  /** Advances: completes the typing effect, or moves to the next line. */
  advance() {
    if (this.isTyping) {
      this.charIndex = this.totalChars;
      return true;
    }
    return this.next();
  }

  visibleLines() {
    let remaining = Math.floor(this.charIndex);
    return this.lines.map((line) => {
      if (remaining <= 0) return '';
      const slice = line.slice(0, remaining);
      remaining -= line.length;
      return slice;
    });
  }

  render(ctx, x, y, w, h, time) {
    panel(ctx, x, y, w, h);
    const lines = this.visibleLines();
    let ty = y + 14;
    if (this.speaker) {
      text(ctx, this.speaker, x + 16, ty, { color: COLORS.accent, size: 13, weight: 'bold' });
      ty += 20;
    }
    for (const line of lines) {
      text(ctx, line, x + 16, ty, { size: 15 });
      ty += 21;
    }
    if (!this.isTyping && !this.done) continueArrow(ctx, x + w - 26, y + h - 20, time);
  }
}

/** Centre-screen banner used for level ups, evolutions and quest updates. */
export function banner(ctx, str, x, y, w, opts = {}) {
  const h = opts.height || 34;
  panel(ctx, x, y, w, h, { fill: opts.fill || '#2b2140' });
  text(ctx, str, x + w / 2, y + (h - 15) / 2, {
    size: opts.size || 15,
    color: opts.color || COLORS.accent,
    align: 'center',
    weight: 'bold',
  });
}
