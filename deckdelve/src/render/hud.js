// The heads-up display: Threat, the party, the chronicle and the hand of cards.
//
// Two layouts share every drawing routine. `wide` is the desktop arrangement —
// party down the left, chronicle down the right, orders and hand along the
// bottom. `compact` is the one a thumb can reach: everything in full-width
// bands, big targets, short labels. The scene never branches; the layout does.
//
// Every function returns the rectangles it drew so the scene can hit-test them
// without a second layout pass.

import { THREAT_BANDS, bandFor } from '../systems/threat.js';
import { CLASSES } from '../data/classes.js';
import { TRAITS } from '../data/traits.js';
import { STATUS } from '../data/status.js';
import { clamp, formatTime } from '../core/util.js';
import { COLORS, FONT_DISPLAY, FONT_UI, bar, button, icon, panel, roundRect, text, wrap } from './ui.js';
import { drawCard } from './cards.js';

export const LOG_COLOR = {
  plain: '#cfc6b2',
  good: '#9fd08a',
  bad: '#e0866a',
  biome: '#c9a8f0',
  boss: '#ff9a6a',
  bark: '#93a8c4',
  loot: '#e8b64c',
  death: '#d5646a',
};

export const ORDERS = [
  { id: 'explore', label: 'Explore', short: 'Explore', key: 'E', blurb: 'Find the next thing worth doing and do it.' },
  { id: 'rally', label: 'Rally', short: 'Rally', key: 'RMB', blurb: 'Then tap the map to call them somewhere.' },
  { id: 'hold', label: 'Hold', short: 'Hold', key: 'H', blurb: 'Stand here. Fight what comes. Do not wander.' },
  { id: 'retreat', label: 'Retreat', short: 'Back', key: 'B', blurb: 'Back to the entrance, fighting only what blocks the way.' },
  { id: 'rest', label: 'Rest', short: 'Rest', key: 'V', blurb: 'Catch breath. Only works with nothing hunting you.' },
  { id: 'interact', label: 'Interact', short: 'Use', key: 'C', blurb: 'Work whatever is in this room: chests, shrines, dials.' },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function layoutFor(w, h, compact) {
  return compact ? compactLayout(w, h) : wideLayout(w, h);
}

function wideLayout(w, h) {
  const handH = 120;
  const mapH = h - 38 - handH;
  return {
    w,
    h,
    compact: false,
    top: { x: 0, y: 0, w, h: 38 },
    map: { x: 0, y: 38, w, h: mapH },
    hand: { x: 0, y: h - handH, w, h: handH },
    // Four portraits down the left, shrunk if the window is short.
    party: { x: 10, y: 48, w: 190, h: clamp((mapH - 30) / 4 - 6, 44, 64) },
    log: { x: w - 266, y: 48, w: 256, h: clamp(mapH - 40, 120, 228) },
    cardW: 86,
    cardH: 104,
  };
}

function compactLayout(w, h) {
  const gutter = 8;
  const topH = 62;
  const partyH = 64;
  const ordersH = 46;
  const cardH = clamp(h * 0.15, 96, 122);
  const handH = cardH + 32;
  const mapY = topH + partyH;
  const mapH = h - mapY - ordersH - handH;
  const cardW = Math.min(92, (w - gutter * 2 - 16) / 5);
  return {
    w,
    h,
    compact: true,
    gutter,
    top: { x: 0, y: 0, w, h: topH },
    party: { x: gutter, y: topH + 2, w: w - gutter * 2, h: partyH - 6 },
    map: { x: 0, y: mapY, w, h: mapH },
    orders: { x: 0, y: mapY + mapH, w, h: ordersH },
    hand: { x: 0, y: h - handH, w, h: handH },
    log: { x: gutter, y: mapY + mapH - 92, w: w - gutter * 2, h: 88 },
    cardW,
    cardH,
  };
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function threatColor(value) {
  if (value >= 80) return '#ff6a4a';
  if (value >= 60) return '#ff9a4a';
  if (value >= 40) return '#e8c04a';
  if (value >= 20) return '#b8c86a';
  return '#8fd08a';
}

function barBackdrop(ctx, r) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  grad.addColorStop(0, '#16141d');
  grad.addColorStop(1, 'rgba(12,11,17,0.86)');
  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h - 0.5);
  ctx.lineTo(r.x + r.w, r.y + r.h - 0.5);
  ctx.stroke();
  ctx.restore();
}

export function drawTopBar(ctx, exp, layout, state) {
  const r = layout.top;
  barBackdrop(ctx, r);
  const band = bandFor(exp.threat.value);
  const buttons = {};
  const gold = exp.party.reduce((a, p) => a + (p.alive ? p.carriedGold : 0), 0);

  if (layout.compact) {
    const bh = 30;
    const by = 5;
    buttons.extract = { x: layout.w - 74, y: by, w: 66, h: bh };
    buttons.menu = { x: layout.w - 74 - 38, y: by, w: 32, h: bh };
    const threatW = buttons.menu.x - 20;
    text(ctx, 'THREAT', 10, 13, { size: 8, color: COLORS.faint });
    bar(ctx, 10, 16, threatW, 9, exp.threat.fraction, threatColor(exp.threat.value));
    threatTicks(ctx, 10, 16, threatW, 9);
    if (exp.threat.pulse > 0) threatPulse(ctx, 10, 16, threatW, 9, exp.threat.pulse);
    text(ctx, `${band.name} · ${Math.round(exp.threat.value)}`, 10 + threatW + 6, 25, {
      size: 10,
      color: threatColor(exp.threat.value),
      font: FONT_DISPLAY,
      align: 'right',
    });
    compactStats(ctx, exp, gold, 10, 46, layout.w - 20);
    button(ctx, buttons.extract, exp.bossSlain ? 'Claim' : exp.extracting ? 'Stop' : 'Extract', {
      hover: state.hover === 'extract',
      active: exp.extracting,
      size: 11,
    });
    button(ctx, buttons.menu, exp.paused ? '▶' : '❚❚', { hover: state.hover === 'menu', active: exp.paused });
    return buttons;
  }

  const tw = 210;
  text(ctx, 'THREAT', 14, 16, { size: 8, color: COLORS.faint });
  bar(ctx, 14, 20, tw, 9, exp.threat.fraction, threatColor(exp.threat.value));
  threatTicks(ctx, 14, 20, tw, 9);
  if (exp.threat.pulse > 0) threatPulse(ctx, 14, 20, tw, 9, exp.threat.pulse);
  text(ctx, `${band.name} · ${Math.round(exp.threat.value)}`, 14 + tw + 10, 27, {
    size: 11,
    color: threatColor(exp.threat.value),
    font: FONT_DISPLAY,
  });

  const stats = [
    { icon: 'coin', color: COLORS.gold, value: `${Math.round(gold)}`, label: 'carried' },
    { icon: 'down', color: COLORS.violet, value: `${exp.dungeon.deepestEntered()}`, label: 'deep' },
    { icon: 'skull', color: COLORS.blood, value: `${exp.kills}`, label: 'killed' },
    { icon: 'clock', color: COLORS.dim, value: formatTime(exp.time), label: 'elapsed' },
  ];
  let x = Math.min(420, layout.w - 560);
  for (const s of stats) {
    icon(ctx, s.icon, x, 19, 11, s.color);
    text(ctx, s.value, x + 10, 23, { size: 13, color: COLORS.ink, weight: 'bold' });
    text(ctx, s.label, x + 10, 33, { size: 7, color: COLORS.faint });
    x += 66;
  }

  const bw = 74;
  const by = 7;
  buttons.extract = { x: layout.w - bw - 10, y: by, w: bw, h: 24 };
  button(ctx, buttons.extract, exp.bossSlain ? 'Claim' : exp.extracting ? 'Cancel' : 'Extract', {
    hover: state.hover === 'extract',
    active: exp.extracting,
  });
  buttons.speed = { x: layout.w - bw * 2 - 18, y: by, w: 40, h: 24 };
  button(ctx, buttons.speed, `${exp.speed}×`, { hover: state.hover === 'speed' });
  buttons.pause = { x: layout.w - bw * 2 - 62, y: by, w: 40, h: 24 };
  button(ctx, buttons.pause, exp.paused ? '▶' : '❚❚', { hover: state.hover === 'pause' });
  buttons.help = { x: layout.w - bw * 2 - 106, y: by, w: 40, h: 24 };
  button(ctx, buttons.help, '?', { hover: state.hover === 'help', active: state.showHelp });
  return buttons;
}

function threatTicks(ctx, x, y, w, h) {
  for (const b of THREAT_BANDS) {
    if (!b.at) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + (b.at / 100) * w, y, 1, h);
  }
}

function threatPulse(ctx, x, y, w, h, pulse) {
  ctx.save();
  ctx.globalAlpha = Math.min(0.7, pulse);
  ctx.fillStyle = '#ff7a4a';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function compactStats(ctx, exp, gold, x, y, w) {
  const entries = [
    ['coin', COLORS.gold, `${Math.round(gold)}g`],
    ['down', COLORS.violet, `${exp.dungeon.deepestEntered()} deep`],
    ['skull', COLORS.blood, `${exp.kills}`],
    ['clock', COLORS.dim, formatTime(exp.time)],
  ];
  const step = w / entries.length;
  entries.forEach((e, i) => {
    icon(ctx, e[0], x + i * step + 6, y, 10, e[1]);
    text(ctx, e[2], x + i * step + 16, y + 4, { size: 11, color: COLORS.ink });
  });
}

/** The overflow sheet a compact screen needs: speed, help, recentre. */
export function drawMenuSheet(ctx, exp, layout, state) {
  const w = Math.min(260, layout.w - 40);
  const x = layout.w - w - 10;
  const y = layout.top.h + 6;
  const rows = [
    { id: 'speed', label: `Game speed — ${exp.speed}×` },
    { id: 'pause', label: exp.paused ? 'Resume' : 'Pause' },
    { id: 'follow', label: state.follow ? 'Camera: following' : 'Camera: free — recentre' },
    { id: 'help', label: 'How this works' },
  ];
  const h = 12 + rows.length * 40;
  panel(ctx, x, y, w, h, { fill: 'rgba(12, 11, 18, 0.97)', edge: COLORS.edgeBright, line: 2 });
  const rects = {};
  rows.forEach((row, i) => {
    const r = { x: x + 8, y: y + 6 + i * 40, w: w - 16, h: 36 };
    rects[row.id] = r;
    button(ctx, r, row.label, { hover: state.hover === `sheet_${row.id}`, size: 12 });
  });
  return rects;
}

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------

export function drawParty(ctx, exp, layout, state) {
  return layout.compact ? drawPartyStrip(ctx, exp, layout, state) : drawPartyColumn(ctx, exp, layout, state);
}

function portraitChip(ctx, adv, x, y, size, dead) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = dead ? '#3a2a2e' : adv.color;
  roundRect(ctx, -size / 2, -size / 2, size, size, 4);
  ctx.fill();
  ctx.fillStyle = dead ? '#6a5a5e' : '#0f0e14';
  ctx.font = `bold ${Math.round(size * 0.55)}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillText((CLASSES[adv.classId] || { name: '?' }).name[0], 0, size * 0.2);
  ctx.restore();
}

function statusRow(ctx, adv, x, y, size = 7) {
  let px = x;
  const seen = new Set();
  for (const s of adv.statuses) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const def = STATUS[s.id];
    if (!def) continue;
    icon(ctx, def.icon, px, y, size, def.color);
    px += size + 2;
  }
}

function drawPartyColumn(ctx, exp, layout, state) {
  const rects = [];
  const base = layout.party;
  exp.party.forEach((adv, i) => {
    const r = { x: base.x, y: base.y + i * (base.h + 6), w: base.w, h: base.h, adv };
    rects.push(r);
    const dead = !adv.alive;
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: dead ? 'rgba(28, 16, 18, 0.75)' : adv.selected ? 'rgba(38, 34, 26, 0.92)' : COLORS.panel,
      edge: dead ? '#5a3038' : adv.selected ? COLORS.gold : state.hover === `party${i}` ? COLORS.edgeBright : COLORS.edge,
    });
    portraitChip(ctx, adv, r.x + 20, r.y + 22, 26, dead);
    text(ctx, adv.name, r.x + 38, r.y + 15, { size: 11, color: dead ? '#8a6a6e' : COLORS.ink, font: FONT_DISPLAY });
    text(ctx, `${(CLASSES[adv.classId] || {}).name || '?'} · L${adv.level}`, r.x + 38, r.y + 27, {
      size: 9,
      color: COLORS.dim,
    });
    if (dead) {
      text(ctx, 'lost in the dark', r.x + 38, r.y + 44, { size: 10, color: '#a05a60' });
      return;
    }
    bar(ctx, r.x + 38, r.y + 33, r.w - 48, 7, adv.hp / adv.maxHp, adv.hp / adv.maxHp > 0.35 ? '#7dc96f' : '#d2503f');
    text(ctx, `${Math.ceil(adv.hp)}`, r.x + 42, r.y + 39.5, { size: 8, color: '#0b0a0e', weight: 'bold', shadow: false });
    if (r.h >= 56) {
      text(ctx, `${adv.order} · ${adv.fleeing ? 'fleeing' : adv.state}`, r.x + 38, r.y + 52, {
        size: 8,
        color: adv.fleeing ? '#ff9a6a' : COLORS.faint,
      });
      if (adv.carriedGold > 0) {
        text(ctx, `${Math.round(adv.carriedGold)}g`, r.x + r.w - 8, r.y + 52, {
          size: 9,
          color: COLORS.gold,
          align: 'right',
        });
      }
      statusRow(ctx, adv, r.x + 8, r.y + 46);
    }
  });
  return rects;
}

function drawPartyStrip(ctx, exp, layout, state) {
  const rects = [];
  const base = layout.party;
  const gap = 6;
  const cw = (base.w - gap * (exp.party.length - 1)) / exp.party.length;
  exp.party.forEach((adv, i) => {
    const r = { x: base.x + i * (cw + gap), y: base.y, w: cw, h: base.h, adv };
    rects.push(r);
    const dead = !adv.alive;
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: dead ? 'rgba(28, 16, 18, 0.8)' : adv.selected ? 'rgba(40, 35, 26, 0.95)' : 'rgba(20, 18, 26, 0.92)',
      edge: dead ? '#5a3038' : adv.selected ? COLORS.gold : COLORS.edge,
      radius: 5,
    });
    portraitChip(ctx, adv, r.x + 17, r.y + 17, 22, dead);
    const first = adv.name.split(' ')[0];
    text(ctx, first, r.x + 31, r.y + 15, {
      size: 10,
      color: dead ? '#8a6a6e' : COLORS.ink,
      font: FONT_DISPLAY,
    });
    text(ctx, dead ? 'lost' : `L${adv.level}`, r.x + 31, r.y + 26, {
      size: 8,
      color: dead ? '#a05a60' : COLORS.dim,
    });
    if (dead) return;
    bar(ctx, r.x + 7, r.y + 34, r.w - 14, 7, adv.hp / adv.maxHp, adv.hp / adv.maxHp > 0.35 ? '#7dc96f' : '#d2503f');
    const foot = adv.fleeing ? 'fleeing' : adv.state === 'interacting' ? 'working' : adv.state;
    text(ctx, foot, r.x + 7, r.y + 52, { size: 8, color: adv.fleeing ? '#ff9a6a' : COLORS.faint });
    if (adv.carriedGold > 0) {
      text(ctx, `${Math.round(adv.carriedGold)}g`, r.x + r.w - 7, r.y + 52, {
        size: 8,
        color: COLORS.gold,
        align: 'right',
      });
    }
    statusRow(ctx, adv, r.x + 7, r.y + 45, 6);
  });
  return rects;
}

/** The hover — or, on a touch screen, tap-and-hold — card for one adventurer. */
export function drawAdventurerTip(ctx, adv, x, y, layout) {
  const w = Math.min(250, layout.w - 16);
  const traits = (adv.traits || []).map((t) => TRAITS[t]).filter(Boolean);
  const h = 96 + traits.length * 28;
  const tx = clamp(x, 8, layout.w - w - 8);
  const ty = clamp(y, 8, layout.h - h - 8);
  panel(ctx, tx, ty, w, h, { fill: 'rgba(14, 13, 19, 0.97)', edge: COLORS.edgeBright });
  const cls = CLASSES[adv.classId] || {};
  text(ctx, adv.name, tx + 10, ty + 18, { size: 13, font: FONT_DISPLAY, color: COLORS.ink });
  text(ctx, `${cls.name} · level ${adv.level} · ${adv.expeditions} expeditions`, tx + 10, ty + 32, {
    size: 9,
    color: COLORS.dim,
  });
  text(ctx, `HP ${Math.ceil(adv.hp)}/${adv.maxHp}   DMG ${adv.damage}   ARM ${adv.armor}`, tx + 10, ty + 48, {
    size: 9,
    color: COLORS.dim,
  });
  text(ctx, `nerve: leaves at ${Math.round(adv.fleeThreshold * 100)}% health`, tx + 10, ty + 62, {
    size: 9,
    color: '#c9a86a',
  });
  let cy = ty + 80;
  for (const t of traits) {
    text(ctx, t.name, tx + 10, cy, { size: 10, color: COLORS.violet });
    wrap(ctx, t.blurb, w - 24, { size: 9 }).slice(0, 2).forEach((line, i) =>
      text(ctx, line, tx + 10, cy + 11 + i * 10, { size: 9, color: COLORS.dim }),
    );
    cy += 28;
  }
}

// ---------------------------------------------------------------------------
// Chronicle
// ---------------------------------------------------------------------------

export function drawLog(ctx, exp, layout) {
  const r = layout.log;
  ctx.save();
  const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  grad.addColorStop(0, 'rgba(12, 11, 17, 0.12)');
  grad.addColorStop(0.35, 'rgba(12, 11, 17, 0.74)');
  grad.addColorStop(1, 'rgba(12, 11, 17, 0.84)');
  ctx.fillStyle = grad;
  roundRect(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fill();
  ctx.restore();

  const entries = exp.chronicle.entries.slice(-14).reverse();
  const size = layout.compact ? 10 : 10;
  let y = r.y + r.h - 8;
  for (const entry of entries) {
    const lineSize = entry.kind === 'biome' || entry.kind === 'boss' ? size + 1 : size;
    const lines = wrap(ctx, entry.text, r.w - 18, { size: lineSize });
    const blockH = lines.length * (lineSize + 3);
    if (y - blockH < r.y + 4) break;
    y -= blockH;
    const fade = Math.max(0.35, 1 - entry.age / 60);
    lines.forEach((line, i) => {
      text(ctx, line, r.x + 10, y + i * (lineSize + 3) + lineSize, {
        size: lineSize,
        color: LOG_COLOR[entry.kind] || LOG_COLOR.plain,
        alpha: fade,
        font: entry.kind === 'bark' ? FONT_DISPLAY : FONT_UI,
      });
    });
    y -= 5;
  }
}

// ---------------------------------------------------------------------------
// Orders and hand
// ---------------------------------------------------------------------------

export function drawOrders(ctx, exp, layout, state) {
  const compact = layout.compact;
  const r = compact ? layout.orders : layout.hand;
  if (compact) barBackdrop(ctx, r);

  const rects = [];
  if (compact) {
    const gap = 4;
    const pad = 8;
    const bw = (r.w - pad * 2 - gap * (ORDERS.length - 1)) / ORDERS.length;
    ORDERS.forEach((order, i) => {
      const rect = { x: pad + i * (bw + gap), y: r.y + 6, w: bw, h: r.h - 12, order };
      rects.push(rect);
      const selection = state.selection.length ? state.selection : exp.living;
      const allSame = selection.length && selection.every((a) => a.order === order.id);
      button(ctx, rect, order.short, {
        hover: state.hover === `order${i}`,
        active: order.id === 'rally' ? state.rallyArmed : allSame && !state.rallyArmed,
        size: 11,
      });
    });
    return rects;
  }

  const ow = 84;
  const oh = 24;
  ORDERS.forEach((order, i) => {
    const bx = 12 + (i % 2) * (ow + 6);
    const by = r.y + 12 + Math.floor(i / 2) * (oh + 5);
    const rect = { x: bx, y: by, w: ow, h: oh, order };
    rects.push(rect);
    const selection = state.selection.length ? state.selection : exp.living;
    const allSame = selection.length && selection.every((a) => a.order === order.id);
    button(ctx, rect, order.label, {
      hover: state.hover === `order${i}`,
      active: order.id === 'rally' ? state.rallyArmed : allSame && !state.rallyArmed,
      size: 11,
    });
    text(ctx, order.key, bx + ow - 5, by + oh - 4, { size: 7, color: COLORS.faint, align: 'right' });
  });
  const selectionLabel = state.selection.length ? `${state.selection.length} selected` : 'whole party';
  text(ctx, `ORDERS · ${selectionLabel}`, 12, r.y + 9, { size: 8, color: COLORS.faint });
  return rects;
}

export function drawHandBar(ctx, exp, layout, state) {
  const r = layout.hand;
  const compact = layout.compact;
  ctx.save();
  const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  grad.addColorStop(0, 'rgba(10,9,14,0.55)');
  grad.addColorStop(0.2, '#15131c');
  grad.addColorStop(1, '#100f16');
  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = COLORS.edge;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + 0.5);
  ctx.lineTo(r.x + r.w, r.y + 0.5);
  ctx.stroke();
  ctx.restore();

  const cardW = layout.cardW;
  const cardH = layout.cardH;
  const cards = exp.deck.hand;
  const cardRects = [];
  const rects = { cardRects, rotate: null, mulligan: null };

  if (compact) {
    // A strip of controls above the cards: what the keyboard does on a desk.
    const stripY = r.y + 4;
    const bw = 76;
    rects.rotate = { x: r.w - bw * 2 - 14, y: stripY, w: bw, h: 24 };
    rects.mulligan = { x: r.w - bw - 8, y: stripY, w: bw, h: 24 };
    button(ctx, rects.rotate, 'Rotate ⟳', { hover: state.hover === 'rotate', disabled: !state.heldCard, size: 11 });
    button(ctx, rects.mulligan, 'Throw back', { hover: state.hover === 'mulligan', disabled: !state.heldCard, size: 10 });
    text(
      ctx,
      state.heldCard ? 'Tap a green cell to build' : `Pick a card · deck ${exp.deck.remaining} · next ${Math.ceil(exp.deck.drawTimer)}s`,
      10,
      stripY + 16,
      { size: 10, color: state.heldCard ? COLORS.gold : COLORS.dim },
    );

    const gap = 4;
    const totalW = cards.length * cardW + (cards.length - 1) * gap;
    const left = Math.max(8, (r.w - totalW) / 2);
    cards.forEach((entry, i) => {
      const rect = { x: left + i * (cardW + gap), y: r.y + 32, w: cardW, h: cardH, entry };
      cardRects.push(rect);
      drawCard(ctx, rect, { card: entry.card, doorsMask: exp.deck.doorsOf(entry) }, {
        selected: state.heldCard === entry.uid,
        hover: state.hover === `card${i}`,
        showBlurb: false,
        rotations: entry.rotations,
      });
    });
    if (!cards.length) {
      text(ctx, 'No cards in hand. One will come to you shortly.', r.w / 2, r.y + 32 + cardH / 2, {
        align: 'center',
        size: 11,
        color: COLORS.faint,
      });
    }
    return rects;
  }

  const handLeft = 12 + 84 * 2 + 24;
  const handRight = r.w - 150;
  const spacing = Math.min(cardW + 8, (handRight - handLeft) / Math.max(1, cards.length));
  cards.forEach((entry, i) => {
    const rect = { x: handLeft + i * spacing, y: r.y + 10, w: cardW, h: cardH, entry };
    cardRects.push(rect);
    drawCard(ctx, rect, { card: entry.card, doorsMask: exp.deck.doorsOf(entry) }, {
      selected: state.heldCard === entry.uid,
      hover: state.hover === `card${i}`,
      showBlurb: false,
      rotations: entry.rotations,
    });
    text(ctx, String(i + 1), rect.x + 4, rect.y + cardH - 5, { size: 9, color: COLORS.faint });
  });
  if (!cards.length) {
    text(ctx, 'No cards in hand. One will come to you shortly.', handLeft, r.y + 54, {
      size: 11,
      color: COLORS.faint,
    });
  }

  const sideX = r.w - 138;
  rects.rotate = { x: sideX, y: r.y + 14, w: 126, h: 26 };
  button(ctx, rects.rotate, 'Rotate  (R)', { hover: state.hover === 'rotate', disabled: !state.heldCard });
  rects.mulligan = { x: sideX, y: r.y + 44, w: 126, h: 26 };
  button(ctx, rects.mulligan, 'Throw back', { hover: state.hover === 'mulligan', disabled: !state.heldCard });
  wrap(ctx, state.heldCard ? 'Click a highlighted cell to build.' : 'Pick a card, then click the map.', 126, { size: 9 })
    .forEach((line, i) => text(ctx, line, sideX, r.y + 80 + i * 11, { size: 9, color: COLORS.dim }));
  text(
    ctx,
    `deck ${exp.deck.remaining} · discard ${exp.deck.discard.length} · next in ${Math.ceil(exp.deck.drawTimer)}s`,
    sideX,
    r.y + r.h - 8,
    { size: 8, color: COLORS.faint },
  );
  return rects;
}

// ---------------------------------------------------------------------------
// Flourishes
// ---------------------------------------------------------------------------

export function drawBiomeFlash(ctx, exp, layout) {
  const flash = exp.newBiomeFlash;
  if (!flash) return;
  const t = Math.min(1, flash.t / 3.2);
  const alpha = Math.sin(Math.min(1, (1 - t) * 4)) * Math.min(1, flash.t * 1.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  const y = layout.map.y + (layout.compact ? 30 : 74);
  const w = Math.min(440, layout.w - 24);
  const x = (layout.w - w) / 2;
  panel(ctx, x, y, w, 58, { fill: 'rgba(16, 12, 24, 0.92)', edge: flash.biome.tint, line: 2 });
  const lines = wrap(ctx, flash.biome.name.toUpperCase(), w - 24, { size: 20, font: FONT_DISPLAY });
  text(ctx, lines[0], layout.w / 2, y + (lines.length > 1 ? 22 : 26), {
    align: 'center',
    size: 20,
    color: flash.biome.tint,
    font: FONT_DISPLAY,
  });
  if (lines[1]) {
    text(ctx, lines[1], layout.w / 2, y + 42, { align: 'center', size: 20, color: flash.biome.tint, font: FONT_DISPLAY });
  } else {
    text(ctx, 'rooms have combined', layout.w / 2, y + 44, { align: 'center', size: 10, color: COLORS.dim });
  }
  ctx.restore();
}

export function drawHelp(ctx, layout, touch) {
  const w = Math.min(470, layout.w - 24);
  const rows = touch
    ? [
      ['Tap a card', 'then tap a green cell to build it'],
      ['Rotate ⟳', 'turn the held card until its doors line up'],
      ['Tap someone', 'select them — orders apply to the selection'],
      ['Press and hold', 'on the map: rally there · on a monster: focus fire'],
      ['Rally', 'arms a one-tap rally — then tap where you want them'],
      ['Drag', 'move the camera  ·  pinch to zoom'],
      ['❚❚', 'pause, game speed, recentre the camera'],
    ]
    : [
      ['1 – 6', 'pick a room card from your hand'],
      ['R  /  Q', 'rotate the held card'],
      ['Left click', 'build on a highlighted cell — doors must line up'],
      ['Left click', 'on an adventurer or portrait: select them'],
      ['Right click', 'rally the selection there · on a monster: focus fire'],
      ['E H B V C', 'Explore · Hold · fall Back · Rest · Interact'],
      ['`', 'select the whole party  ·  Esc: drop the card / clear it'],
      ['Space', 'pause  ·  Tab: game speed  ·  F: follow the party'],
      ['WASD', 'pan the camera  ·  wheel: zoom  ·  middle-drag: pan'],
    ];
  const h = 108 + rows.length * 22 + 46;
  const x = (layout.w - w) / 2;
  const y = clamp((layout.h - h) / 2, 8, layout.h - h - 8);
  panel(ctx, x, y, w, h, { fill: 'rgba(12, 11, 18, 0.97)', edge: COLORS.edgeBright, line: 2 });
  text(ctx, 'How this works', x + 20, y + 30, { size: 17, font: FONT_DISPLAY, color: COLORS.gold });
  const labelW = touch ? 108 : 90;
  rows.forEach((row, i) => {
    text(ctx, row[0], x + 20, y + 64 + i * 22, { size: 11, color: COLORS.violet, weight: 'bold' });
    wrap(ctx, row[1], w - labelW - 30, { size: 11 }).slice(0, 1).forEach((line) =>
      text(ctx, line, x + 20 + labelW, y + 64 + i * 22, { size: 11, color: COLORS.ink }),
    );
  });
  const foot =
    'Your people explore, fight and loot on their own. What you control is the shape of the dungeon, ' +
    'the orders you give, and the moment you decide to leave. Threat only goes up.';
  wrap(ctx, foot, w - 40, { size: 10 }).forEach((line, i) =>
    text(ctx, line, x + 20, y + h - 58 + i * 14, { size: 10, color: COLORS.dim }),
  );
  text(ctx, 'tap anywhere to close', x + w / 2, y + h - 12, { align: 'center', size: 9, color: COLORS.faint });
}
