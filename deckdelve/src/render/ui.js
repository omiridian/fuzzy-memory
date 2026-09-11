// Drawing primitives. Panels, text, bars, buttons — the bits every screen uses.

export const COLORS = {
  ink: '#eee6d4',
  dim: '#a39a86',
  faint: '#6f6a5e',
  gold: '#e8b64c',
  blood: '#d2603f',
  green: '#8fd08a',
  blue: '#6fb8f0',
  violet: '#a98fd8',
  panel: 'rgba(20, 18, 26, 0.9)',
  panelSolid: '#171520',
  edge: '#4a4258',
  edgeBright: '#7c6f92',
  shadow: 'rgba(0,0,0,0.55)',
};

export const FONT_DISPLAY = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, opts.radius === undefined ? 6 : opts.radius);
  ctx.fillStyle = opts.fill || COLORS.panel;
  ctx.fill();
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = opts.edge || COLORS.edge;
  ctx.lineWidth = opts.line || 1.5;
  ctx.stroke();
  ctx.restore();
}

export function text(ctx, str, x, y, opts = {}) {
  ctx.save();
  const size = opts.size || 14;
  ctx.font = `${opts.weight ? opts.weight + ' ' : ''}${size}px ${opts.font || FONT_UI}`;
  ctx.fillStyle = opts.color || COLORS.ink;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = opts.shadowBlur === undefined ? 3 : opts.shadowBlur;
    ctx.shadowOffsetY = 1;
  }
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** Width of a string in the same font `text` would use. */
export function measure(ctx, str, opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight ? opts.weight + ' ' : ''}${opts.size || 14}px ${opts.font || FONT_UI}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Greedy word wrap against a pixel width. */
export function wrap(ctx, str, width, opts = {}) {
  const words = String(str).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(ctx, candidate, opts) <= width || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function paragraph(ctx, str, x, y, width, opts = {}) {
  const lines = wrap(ctx, str, width, opts);
  const lh = opts.lineHeight || (opts.size || 13) + 4;
  lines.forEach((line, i) => text(ctx, line, x, y + i * lh, opts));
  return lines.length * lh;
}

export function bar(ctx, x, y, w, h, fraction, color, opts = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, opts.radius === undefined ? h / 2 : opts.radius);
  ctx.fillStyle = opts.back || 'rgba(0,0,0,0.55)';
  ctx.fill();
  const f = Math.max(0, Math.min(1, fraction));
  if (f > 0) {
    ctx.save();
    roundRect(ctx, x, y, w, h, opts.radius === undefined ? h / 2 : opts.radius);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * f, h);
    if (opts.gloss !== false) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x, y, w * f, h * 0.45);
    }
    ctx.restore();
  }
  if (opts.edge !== false) {
    roundRect(ctx, x, y, w, h, opts.radius === undefined ? h / 2 : opts.radius);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A clickable rectangle. Buttons are immediate-mode: the caller draws one every
 * frame and asks the scene's pointer state whether it was hit.
 */
export function button(ctx, rect, label, state = {}) {
  const { x, y, w, h } = rect;
  const disabled = !!state.disabled;
  const hot = !disabled && state.hover;
  ctx.save();
  roundRect(ctx, x, y, w, h, 5);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  if (disabled) {
    grad.addColorStop(0, '#26232e');
    grad.addColorStop(1, '#1a1822');
  } else if (state.active) {
    grad.addColorStop(0, '#584a2c');
    grad.addColorStop(1, '#3a3020');
  } else if (hot) {
    grad.addColorStop(0, '#3d3750');
    grad.addColorStop(1, '#2a2538');
  } else {
    grad.addColorStop(0, '#2c2838');
    grad.addColorStop(1, '#1e1b28');
  }
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = state.active ? COLORS.gold : hot ? COLORS.edgeBright : COLORS.edge;
  ctx.lineWidth = state.active ? 2 : 1.4;
  ctx.stroke();
  ctx.restore();

  text(ctx, label, x + w / 2, y + h / 2 + 4, {
    align: 'center',
    size: state.size || 12,
    color: disabled ? COLORS.faint : state.active ? COLORS.gold : COLORS.ink,
    font: state.font || FONT_UI,
    weight: state.weight,
  });
  return rect;
}

export function hit(rect, px, py) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** A soft vignette over the whole frame — does a lot for the mood. */
export function vignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Small pictographs used on cards and status pips. */
export function icon(ctx, kind, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.16);
  const s = size / 2;
  switch (kind) {
    case 'skull':
      ctx.beginPath();
      ctx.arc(0, -s * 0.2, s * 0.75, Math.PI, 0);
      ctx.lineTo(s * 0.55, s * 0.45);
      ctx.lineTo(-s * 0.55, s * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    case 'coin':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.9, 0, 0, s);
      ctx.quadraticCurveTo(-s * 0.9, 0, 0, -s);
      ctx.fill();
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, -s * 0.5);
      ctx.lineTo(s * 0.55, s * 0.8);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.55, s * 0.8);
      ctx.lineTo(-s * 0.8, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.85, s * 0.25, 0, s);
      ctx.quadraticCurveTo(-s * 0.85, s * 0.25, 0, -s);
      ctx.fill();
      break;
    case 'snow':
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(-s, 0);
        ctx.lineTo(s, 0);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 'star':
    case 'sun':
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.42 : s;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.5, s, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'target':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'eye':
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'down':
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, -s * 0.4);
      ctx.lineTo(s * 0.8, -s * 0.4);
      ctx.lineTo(0, s * 0.9);
      ctx.closePath();
      ctx.fill();
      break;
    case 'clock':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.55);
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.42, 0);
      ctx.stroke();
      break;
    case 'wing':
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.4);
      ctx.quadraticCurveTo(0, -s, s, s * 0.4);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}
