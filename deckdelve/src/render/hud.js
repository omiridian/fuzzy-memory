// The heads-up display: Threat, the party, the chronicle and the hand of cards.
// Every function returns the rectangles it drew so the scene can hit-test them
// without a second layout pass.

import { THREAT_BANDS, bandFor } from '../systems/threat.js';
import { CLASSES } from '../data/classes.js';
import { TRAITS } from '../data/traits.js';
import { STATUS } from '../data/status.js';
import { formatTime } from '../core/util.js';
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
  { id: 'explore', label: 'Explore', key: 'E', blurb: 'Find the next thing worth doing and do it.' },
  { id: 'rally', label: 'Rally', key: 'RMB', blurb: 'Right-click the map to call them somewhere.' },
  { id: 'hold', label: 'Hold', key: 'H', blurb: 'Stand here. Fight what comes. Do not wander.' },
  { id: 'retreat', label: 'Retreat', key: 'B', blurb: 'Back to the entrance, fighting only what blocks the way.' },
  { id: 'rest', label: 'Rest', key: 'V', blurb: 'Catch breath. Only works with nothing hunting you.' },
  { id: 'interact', label: 'Interact', key: 'C', blurb: 'Work whatever is in this room: chests, shrines, dials.' },
];

export function layoutFor(w, h) {
  const handH = 120;
  return {
    w,
    h,
    top: { x: 0, y: 0, w, h: 38 },
    map: { x: 0, y: 38, w, h: h - 38 - handH },
    hand: { x: 0, y: h - handH, w, h: handH },
    party: { x: 10, y: 48, w: 190, h: 64 },
    log: { x: w - 266, y: 48, w: 256, h: 228 },
  };
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

export function drawTopBar(ctx, exp, layout, state) {
  const r = layout.top;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, r.h);
  grad.addColorStop(0, '#16141d');
  grad.addColorStop(1, 'rgba(12,11,17,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, r.h - 0.5);
  ctx.lineTo(r.w, r.h - 0.5);
  ctx.stroke();
  ctx.restore();

  // Threat
  const band = bandFor(exp.threat.value);
  const tw = 210;
  text(ctx, 'THREAT', 14, 16, { size: 8, color: COLORS.faint });
  bar(ctx, 14, 20, tw, 9, exp.threat.fraction, threatColor(exp.threat.value));
  for (const b of THREAT_BANDS) {
    if (!b.at) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(14 + (b.at / 100) * tw, 20, 1, 9);
  }
  if (exp.threat.pulse > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, exp.threat.pulse);
    ctx.fillStyle = '#ff7a4a';
    ctx.fillRect(14, 20, tw, 9);
    ctx.restore();
  }
  text(ctx, `${band.name} · ${Math.round(exp.threat.value)}`, 14 + tw + 10, 27, {
    size: 11,
    color: threatColor(exp.threat.value),
    font: FONT_DISPLAY,
  });

  // Readouts
  const gold = exp.party.reduce((a, p) => a + (p.alive ? p.carriedGold : 0), 0);
  const stats = [
    { icon: 'coin', color: COLORS.gold, value: `${Math.round(gold)}`, label: 'carried' },
    { icon: 'down', color: COLORS.violet, value: `${exp.dungeon.deepestEntered()}`, label: 'deep' },
    { icon: 'skull', color: COLORS.blood, value: `${exp.kills}`, label: 'killed' },
    { icon: 'clock', color: COLORS.dim, value: formatTime(exp.time), label: 'elapsed' },
  ];
  let x = 420;
  for (const s of stats) {
    icon(ctx, s.icon, x, 19, 11, s.color);
    text(ctx, s.value, x + 10, 23, { size: 13, color: COLORS.ink, weight: 'bold' });
    text(ctx, s.label, x + 10, 33, { size: 7, color: COLORS.faint });
    x += 66;
  }

  // Buttons
  const buttons = {};
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

function threatColor(value) {
  if (value >= 80) return '#ff6a4a';
  if (value >= 60) return '#ff9a4a';
  if (value >= 40) return '#e8c04a';
  if (value >= 20) return '#b8c86a';
  return '#8fd08a';
}

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------

export function drawParty(ctx, exp, layout, state) {
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

    // portrait chip
    ctx.save();
    ctx.translate(r.x + 20, r.y + 22);
    ctx.fillStyle = dead ? '#3a2a2e' : adv.color;
    roundRect(ctx, -13, -13, 26, 26, 4);
    ctx.fill();
    ctx.fillStyle = dead ? '#6a5a5e' : '#0f0e14';
    ctx.font = `bold 13px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText((CLASSES[adv.classId] || { name: '?' }).name[0], 0, 5);
    ctx.restore();

    text(ctx, adv.name, r.x + 38, r.y + 15, {
      size: 11,
      color: dead ? '#8a6a6e' : COLORS.ink,
      font: FONT_DISPLAY,
    });
    text(ctx, `${(CLASSES[adv.classId] || {}).name || '?'} · L${adv.level}`, r.x + 38, r.y + 27, {
      size: 9,
      color: COLORS.dim,
    });

    if (dead) {
      text(ctx, 'lost in the dark', r.x + 38, r.y + 45, { size: 10, color: '#a05a60' });
    } else {
      bar(ctx, r.x + 38, r.y + 33, r.w - 48, 7, adv.hp / adv.maxHp, adv.hp / adv.maxHp > 0.35 ? '#7dc96f' : '#d2503f');
      text(ctx, `${Math.ceil(adv.hp)}`, r.x + 42, r.y + 39.5, { size: 8, color: '#0b0a0e', weight: 'bold', shadow: false });

      const stateLabel = adv.fleeing ? 'fleeing' : adv.state;
      text(ctx, `${adv.order} · ${stateLabel}`, r.x + 38, r.y + 52, {
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
      // status pips
      let px = r.x + 8;
      const seen = new Set();
      for (const s of adv.statuses) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        const def = STATUS[s.id];
        if (def) {
          icon(ctx, def.icon, px, r.y + 46, 7, def.color);
          px += 9;
        }
      }
    }
  });
  return rects;
}

/** The hover card for one adventurer: traits, gear, what they are like. */
export function drawAdventurerTip(ctx, adv, x, y) {
  const w = 236;
  const traits = (adv.traits || []).map((t) => TRAITS[t]).filter(Boolean);
  const h = 96 + traits.length * 26;
  const ty = Math.max(8, Math.min(y, 640 - h - 8));
  panel(ctx, x, ty, w, h, { fill: 'rgba(14, 13, 19, 0.97)', edge: COLORS.edgeBright });
  const cls = CLASSES[adv.classId] || {};
  text(ctx, adv.name, x + 10, ty + 18, { size: 13, font: FONT_DISPLAY, color: COLORS.ink });
  text(ctx, `${cls.name} · level ${adv.level} · ${adv.expeditions} expeditions`, x + 10, ty + 32, {
    size: 9,
    color: COLORS.dim,
  });
  text(ctx, `HP ${Math.ceil(adv.hp)}/${adv.maxHp}   DMG ${adv.damage}   ARM ${adv.armor}   SPD ${adv.speed}`, x + 10, ty + 48, {
    size: 9,
    color: COLORS.dim,
  });
  text(ctx, `nerve: leaves at ${Math.round(adv.fleeThreshold * 100)}% health`, x + 10, ty + 62, {
    size: 9,
    color: '#c9a86a',
  });
  let cy = ty + 80;
  for (const t of traits) {
    text(ctx, t.name, x + 10, cy, { size: 10, color: COLORS.violet });
    const lines = wrap(ctx, t.blurb, w - 24, { size: 9 });
    lines.slice(0, 2).forEach((line, i) => text(ctx, line, x + 10, cy + 11 + i * 10, { size: 9, color: COLORS.dim }));
    cy += 26;
  }
}

// ---------------------------------------------------------------------------
// Chronicle
// ---------------------------------------------------------------------------

export function drawLog(ctx, exp, layout) {
  const r = layout.log;
  ctx.save();
  const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  grad.addColorStop(0, 'rgba(12, 11, 17, 0.15)');
  grad.addColorStop(0.35, 'rgba(12, 11, 17, 0.72)');
  grad.addColorStop(1, 'rgba(12, 11, 17, 0.82)');
  ctx.fillStyle = grad;
  roundRect(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fill();
  ctx.restore();

  const entries = exp.chronicle.entries.slice(-14).reverse();
  let y = r.y + r.h - 10;
  for (const entry of entries) {
    const size = entry.kind === 'biome' || entry.kind === 'boss' ? 11 : 10;
    const lines = wrap(ctx, entry.text, r.w - 18, { size });
    const blockH = lines.length * (size + 3);
    if (y - blockH < r.y + 6) break;
    y -= blockH;
    const fade = Math.max(0.35, 1 - entry.age / 60);
    lines.forEach((line, i) => {
      text(ctx, line, r.x + 10, y + i * (size + 3) + size, {
        size,
        color: LOG_COLOR[entry.kind] || LOG_COLOR.plain,
        alpha: fade,
        font: entry.kind === 'bark' ? FONT_DISPLAY : FONT_UI,
      });
    });
    y -= 5;
  }
}

// ---------------------------------------------------------------------------
// Hand and orders
// ---------------------------------------------------------------------------

export function drawHandBar(ctx, exp, layout, state) {
  const r = layout.hand;
  ctx.save();
  const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  grad.addColorStop(0, 'rgba(10,9,14,0.55)');
  grad.addColorStop(0.25, '#15131c');
  grad.addColorStop(1, '#100f16');
  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = COLORS.edge;
  ctx.beginPath();
  ctx.moveTo(0, r.y + 0.5);
  ctx.lineTo(r.w, r.y + 0.5);
  ctx.stroke();
  ctx.restore();

  // Orders, left-hand column
  const orderRects = [];
  const ow = 84;
  const oh = 24;
  ORDERS.forEach((order, i) => {
    const bx = 12 + (i % 2) * (ow + 6);
    const by = r.y + 12 + Math.floor(i / 2) * (oh + 5);
    const rect = { x: bx, y: by, w: ow, h: oh, order };
    orderRects.push(rect);
    const selection = state.selection.length ? state.selection : exp.living;
    const allSame = selection.length && selection.every((a) => a.order === order.id);
    button(ctx, rect, `${order.label}`, {
      hover: state.hover === `order${i}`,
      active: allSame,
      size: 11,
    });
    text(ctx, order.key, bx + ow - 5, by + oh - 4, { size: 7, color: COLORS.faint, align: 'right' });
  });

  const selectionLabel = state.selection.length
    ? `${state.selection.length} selected`
    : 'whole party';
  text(ctx, `ORDERS · ${selectionLabel}`, 12, r.y + 9, { size: 8, color: COLORS.faint });

  // Hand of cards
  const cardW = 86;
  const cardH = 104;
  const handLeft = 12 + ow * 2 + 24;
  const handRight = r.w - 150;
  const cards = exp.deck.hand;
  const spacing = Math.min(cardW + 8, (handRight - handLeft) / Math.max(1, cards.length));
  const cardRects = [];
  cards.forEach((entry, i) => {
    const x = handLeft + i * spacing;
    const y = r.y + 10;
    const rect = { x, y, w: cardW, h: cardH, entry };
    cardRects.push(rect);
    drawCard(
      ctx,
      rect,
      { card: entry.card, doorsMask: exp.deck.doorsOf(entry) },
      {
        selected: state.heldCard === entry.uid,
        hover: state.hover === `card${i}`,
        showBlurb: false,
        rotations: entry.rotations,
      },
    );
    text(ctx, String(i + 1), x + 4, y + cardH - 5, { size: 9, color: COLORS.faint });
  });

  if (!cards.length) {
    text(ctx, 'No cards in hand. One will come to you shortly.', handLeft, r.y + 54, {
      size: 11,
      color: COLORS.faint,
    });
  }

  // Right-hand column: rotate / discard / hint
  const sideX = r.w - 138;
  const rects = { rotate: null, mulligan: null };
  rects.rotate = { x: sideX, y: r.y + 14, w: 126, h: 26 };
  button(ctx, rects.rotate, 'Rotate  (R)', { hover: state.hover === 'rotate', disabled: !state.heldCard });
  rects.mulligan = { x: sideX, y: r.y + 44, w: 126, h: 26 };
  button(ctx, rects.mulligan, 'Throw back', { hover: state.hover === 'mulligan', disabled: !state.heldCard });

  const hint = state.heldCard
    ? 'Click a highlighted cell to build.'
    : 'Pick a card, then click the map.';
  wrap(ctx, hint, 126, { size: 9 }).forEach((line, i) =>
    text(ctx, line, sideX, r.y + 80 + i * 11, { size: 9, color: COLORS.dim }),
  );
  text(
    ctx,
    `deck ${exp.deck.remaining} · discard ${exp.deck.discard.length} · next in ${Math.ceil(exp.deck.drawTimer)}s`,
    sideX,
    r.y + r.h - 8,
    { size: 8, color: COLORS.faint },
  );

  return { orderRects, cardRects, ...rects };
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
  const y = layout.map.y + 74;
  const w = 440;
  const x = (layout.w - w) / 2;
  panel(ctx, x, y, w, 58, { fill: 'rgba(16, 12, 24, 0.9)', edge: flash.biome.tint, line: 2 });
  text(ctx, flash.biome.name.toUpperCase(), layout.w / 2, y + 26, {
    align: 'center',
    size: 20,
    color: flash.biome.tint,
    font: FONT_DISPLAY,
  });
  text(ctx, 'rooms have combined', layout.w / 2, y + 44, {
    align: 'center',
    size: 10,
    color: COLORS.dim,
  });
  ctx.restore();
}

export function drawHelp(ctx, layout) {
  const w = 470;
  const h = 320;
  const x = (layout.w - w) / 2;
  const y = (layout.h - h) / 2;
  panel(ctx, x, y, w, h, { fill: 'rgba(12, 11, 18, 0.97)', edge: COLORS.edgeBright, line: 2 });
  text(ctx, 'How this works', x + 20, y + 30, { size: 17, font: FONT_DISPLAY, color: COLORS.gold });
  const lines = [
    ['1 – 6', 'pick a room card from your hand'],
    ['R  /  Q', 'rotate the held card'],
    ['Left click', 'build it on a highlighted cell — doors must line up'],
    ['Left click', 'on an adventurer or portrait: select them'],
    ['Right click', 'rally the selection there · on a monster: focus fire'],
    ['E H B V C', 'Explore · Hold · fall Back · Rest · Interact'],
    ['`', 'select the whole party  ·  Esc: drop the card / clear it'],
    ['Space', 'pause    ·    Tab: game speed    ·    F: follow the party'],
    ['WASD', 'pan the camera  ·  wheel: zoom  ·  middle-drag: pan'],
  ];
  lines.forEach((row, i) => {
    text(ctx, row[0], x + 20, y + 64 + i * 22, { size: 11, color: COLORS.violet, weight: 'bold' });
    text(ctx, row[1], x + 110, y + 64 + i * 22, { size: 11, color: COLORS.ink });
  });
  const foot =
    'Your people explore, fight and loot on their own. What you control is the shape of the dungeon, ' +
    'the orders you give, and the moment you decide to leave. Threat only goes up.';
  wrap(ctx, foot, w - 40, { size: 10 }).forEach((line, i) =>
    text(ctx, line, x + 20, y + h - 58 + i * 14, { size: 10, color: COLORS.dim }),
  );
  text(ctx, 'click anywhere to close', x + w / 2, y + h - 12, { align: 'center', size: 9, color: COLORS.faint });
}

