// Room cards. The same drawing is used in the hand, in the shop and in the deck
// builder, at whatever size it is handed.

import { SIDES } from '../data/cards.js';
import { COLORS, FONT_DISPLAY, FONT_UI, roundRect, text, wrap } from './ui.js';

const TAG_COLOR = {
  undead: '#9aa38a',
  nature: '#6fb06a',
  arcane: '#7e8fe0',
  goblin: '#9bb34e',
  fire: '#e07a3c',
  ancient: '#b09ad0',
  holy: '#e8d68a',
  treasure: '#e8b64c',
};

const TIER_EDGE = ['#4a4258', '#5b6a4a', '#6a5a84', '#8a5a3a', '#a04a3a'];

/** Little top-down plan of the room, with its doors. */
export function drawCardPlan(ctx, x, y, size, doors, card) {
  const pad = size * 0.1;
  ctx.save();
  ctx.fillStyle = '#1d1b26';
  roundRect(ctx, x, y, size, size, 3);
  ctx.fill();
  ctx.fillStyle = '#2f2c3c';
  ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);

  const gap = size * 0.26;
  const mid = size / 2;
  ctx.fillStyle = '#e2d7b4';
  for (let side = 0; side < 4; side++) {
    if (!(doors & SIDES[side].bit)) continue;
    if (side === 0) ctx.fillRect(x + mid - gap / 2, y, gap, pad);
    else if (side === 2) ctx.fillRect(x + mid - gap / 2, y + size - pad, gap, pad);
    else if (side === 1) ctx.fillRect(x + size - pad, y + mid - gap / 2, pad, gap);
    else ctx.fillRect(x, y + mid - gap / 2, pad, gap);
  }

  // A hint of what is in there, without giving the game away.
  if (card) {
    ctx.globalAlpha = 0.8;
    const plan = card.contents || {};
    if (plan.boss) {
      ctx.fillStyle = '#ff8a6a';
      ctx.beginPath();
      ctx.arc(x + mid, y + mid, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (plan.enemies) {
      ctx.fillStyle = '#d2603f';
      for (let i = 0; i < Math.min(3, plan.enemies.length + 1); i++) {
        ctx.beginPath();
        ctx.arc(x + mid - size * 0.12 + i * size * 0.12, y + mid, size * 0.055, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (plan.loot) {
      ctx.fillStyle = '#e8b64c';
      ctx.fillRect(x + mid - size * 0.07, y + mid + size * 0.14, size * 0.14, size * 0.09);
    }
    if (plan.feature) {
      ctx.strokeStyle = '#b6a8d8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x + mid, y + mid - size * 0.17, size * 0.07, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/**
 * A whole card. `state` carries hover/selected/disabled and an optional count
 * badge for the deck builder.
 */
export function drawCard(ctx, rect, entry, state = {}) {
  const { x, y, w, h } = rect;
  const card = entry.card || entry;
  const doors = entry.doorsMask !== undefined ? entry.doorsMask : card.doors;
  const lift = state.selected ? 10 : state.hover ? 5 : 0;
  const top = y - lift;

  ctx.save();
  if (state.dealT) {
    ctx.globalAlpha = 1 - state.dealT;
    ctx.translate(0, state.dealT * 40);
  }

  // body
  roundRect(ctx, x, top, w, h, 6);
  const grad = ctx.createLinearGradient(0, top, 0, top + h);
  grad.addColorStop(0, state.disabled ? '#201e28' : '#2b2736');
  grad.addColorStop(1, state.disabled ? '#17161e' : '#1b1925');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = state.selected ? COLORS.gold : TIER_EDGE[Math.min(4, card.tier || 0)];
  ctx.lineWidth = state.selected ? 2.4 : 1.4;
  ctx.stroke();
  ctx.restore();

  // The title decides the rest of the layout, so measure it first. A count
  // badge sits in the top-right corner, so keep the words clear of it.
  const titleWidth = w - (state.count === undefined ? 10 : 34);
  const lines = wrap(ctx, card.name, titleWidth, { size: 11, font: FONT_DISPLAY }).slice(0, 2);
  lines.forEach((line, i) => {
    text(ctx, line, x + w / 2, top + 13 + i * 11, {
      align: 'center',
      size: 11,
      color: state.disabled ? COLORS.faint : COLORS.ink,
      font: FONT_DISPLAY,
    });
  });

  const hasTags = !!(card.tags && card.tags.length);
  const footer = (hasTags ? 15 : 0) + (card.threat ? 13 : 0) + (state.cost !== undefined ? 14 : 0) + 8;
  const planTop = top + 6 + lines.length * 11;
  const planSize = Math.max(26, Math.min(w - 18, h - (planTop - top) - footer));
  drawCardPlan(ctx, x + (w - planSize) / 2, planTop, planSize, doors, card);

  let cursor = planTop + planSize + 6;

  // tags
  if (hasTags) {
    let tx = x + 6;
    for (const tag of card.tags.slice(0, 3)) {
      const label = tag.toUpperCase().slice(0, 4);
      const tw = 24;
      ctx.save();
      roundRect(ctx, tx, cursor, tw, 11, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = TAG_COLOR[tag] || COLORS.edge;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      text(ctx, label, tx + tw / 2, cursor + 8, { align: 'center', size: 7, color: TAG_COLOR[tag] || COLORS.dim });
      tx += tw + 3;
    }
    cursor += 15;
  }

  // threat pips
  if (card.threat) {
    text(ctx, 'THREAT', x + 6, cursor + 8, { size: 7, color: COLORS.faint });
    const pips = Math.min(7, Math.ceil(card.threat / 2));
    for (let i = 0; i < pips; i++) {
      ctx.fillStyle = i < 3 ? '#d2a03f' : '#d2603f';
      ctx.fillRect(x + 44 + i * 5.5, cursor + 2, 4, 7);
    }
    cursor += 13;
  }

  if (state.showBlurb !== false && h > 140) {
    const blurbLines = wrap(ctx, card.blurb || '', w - 12, { size: 9 });
    blurbLines.slice(0, 3).forEach((line, i) => {
      text(ctx, line, x + 6, cursor + 10 + i * 10, { size: 9, color: COLORS.dim });
    });
  }

  if (state.count !== undefined) {
    ctx.save();
    roundRect(ctx, x + w - 22, top + 3, 19, 14, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fill();
    ctx.restore();
    text(ctx, `×${state.count}`, x + w - 12.5, top + 13.5, { align: 'center', size: 9, color: COLORS.gold });
  }

  if (state.cost !== undefined) {
    text(ctx, `${state.cost}g`, x + w / 2, top + h - 6, {
      align: 'center',
      size: 11,
      color: state.affordable === false ? '#a06a5a' : COLORS.gold,
      weight: 'bold',
      font: FONT_UI,
    });
  }

  if (state.rotations > 1) {
    text(ctx, '⟳', x + 7, top + 13, { size: 11, color: COLORS.dim });
  }

  return { x, y: top, w, h };
}

