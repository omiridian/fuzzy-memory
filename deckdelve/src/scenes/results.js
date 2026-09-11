// The debrief. What you came back with, who did not, and the line the guild
// will repeat about it for the next month.
//
// Three panels side by side on a wide screen; one scrolling column on a phone.

import { CLASSES } from '../data/classes.js';
import { GEAR_BY_ID, GRADE_COLOR } from '../data/equipment.js';
import { clamp, formatTime, plural } from '../core/util.js';
import { LOG_COLOR } from '../render/hud.js';
import { COLORS, FONT_DISPLAY, button, hit, panel, text, vignette, wrap } from '../render/ui.js';

const TITLES = {
  extracted: { label: 'Extracted', color: '#9fd08a', sub: 'Out through the same hole you went in by.' },
  victory: { label: 'Vault Cleared', color: '#e8b64c', sub: 'Cindervex is dead and the hoard is upstairs.' },
  wiped: { label: 'Party Lost', color: '#d5646a', sub: 'The dungeon keeps what it kills.' },
  timeout: { label: 'Expedition Ended', color: '#a39a86', sub: 'Time ran out down there.' },
};

export class ResultsScene {
  constructor(app, { results, guild }) {
    this.app = app;
    this.results = results;
    this.guild = guild;
    this.hover = null;
    this.buttons = {};
    this.scroll = 0;
    this.scrollMax = 0;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  onPointerMove(x, y) {
    this.hover = null;
    for (const key in this.buttons) if (hit(this.buttons[key], x, y)) this.hover = key;
  }

  onPointerDown(x, y) {
    for (const key in this.buttons) if (hit(this.buttons[key], x, y)) this.app.openGuild();
  }

  onDragStart() {
    return this.app.compact ? 'scroll' : null;
  }

  onDragScroll(dy) {
    this.scroll = clamp(this.scroll - dy, 0, this.scrollMax);
  }

  onWheel(delta) {
    this.scroll = clamp(this.scroll + (delta > 0 ? 46 : -46), 0, this.scrollMax);
  }

  onKeyDown(code) {
    if (code === 'Enter' || code === 'Space' || code === 'Escape') this.app.openGuild();
  }

  stats() {
    const r = this.results;
    return [
      ['Gold recovered', `${r.gold}`, COLORS.gold],
      ['Rooms built', `${r.rooms}`, COLORS.ink],
      ['Deepest room', `${r.depth}`, COLORS.violet],
      ['Killed', `${r.kills}${r.eliteKills ? ` (${r.eliteKills} elite)` : ''}`, COLORS.blood],
      ['Final Threat', `${r.threat}`, '#ff9a4a'],
      ['Time below', formatTime(r.duration), COLORS.dim],
    ];
  }

  chronicleTail() {
    const r = this.results;
    const interesting = ['good', 'bad', 'loot', 'biome', 'boss', 'death'];
    const pool = (r.chronicle || []).filter((e) => interesting.includes(e.kind));
    return (pool.length >= 3 ? pool : (r.chronicle || []).filter((e) => e.kind !== 'bark')).slice(-7);
  }

  draw(ctx) {
    const W = this.app.width;
    const H = this.app.height;
    const r = this.results;
    const info = TITLES[r.outcome] || TITLES.timeout;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#15121c');
    g.addColorStop(1, '#08070d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    vignette(ctx, W, H, 0.6);

    const titleSize = clamp(W * 0.055, 24, 38);
    text(ctx, info.label.toUpperCase(), W / 2, titleSize + 22, {
      align: 'center',
      size: titleSize,
      color: info.color,
      font: FONT_DISPLAY,
    });
    wrap(ctx, info.sub, W - 48, { size: 12 }).slice(0, 1).forEach((line) =>
      text(ctx, line, W / 2, titleSize + 44, { align: 'center', size: 12, color: COLORS.dim }),
    );

    if (this.app.compact) this.drawCompact(ctx, W, H, titleSize + 60);
    else this.drawWide(ctx, W, H);

    const bw = Math.min(240, W - 40);
    this.buttons.back = { x: (W - bw) / 2, y: H - 46, w: bw, h: this.app.compact ? 38 : 32 };
    button(ctx, this.buttons.back, 'Back to the Guild', {
      hover: this.hover === 'back',
      size: 13,
      font: FONT_DISPLAY,
    });
  }

  // --- compact -------------------------------------------------------------

  drawCompact(ctx, W, H, top) {
    const r = this.results;
    const pad = 12;
    const bottom = H - 56;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, bottom - top);
    ctx.clip();
    let y = top - this.scroll;
    const w = W - pad * 2;

    // Numbers
    const stats = this.stats();
    const boxH = 20 + stats.length * 22;
    panel(ctx, pad, y, w, boxH);
    stats.forEach((s, i) => {
      text(ctx, s[0], pad + 14, y + 26 + i * 22, { size: 11, color: COLORS.dim });
      text(ctx, s[1], pad + w - 14, y + 26 + i * 22, { size: 13, color: s[2], align: 'right', weight: 'bold' });
    });
    y += boxH + 10;

    if (r.biomes.length) {
      const bh = 26 + r.biomes.length * 16;
      panel(ctx, pad, y, w, bh);
      text(ctx, 'BIOMES FORMED', pad + 14, y + 18, { size: 9, color: COLORS.faint });
      r.biomes.forEach((b, i) => text(ctx, b, pad + 14, y + 34 + i * 16, { size: 11, color: COLORS.violet }));
      y += bh + 10;
    }

    // People
    const people = [...r.survivors.map((a) => ({ adv: a, lost: false })), ...r.dead.map((a) => ({ adv: a, lost: true }))];
    const ph = 26 + people.length * 32;
    panel(ctx, pad, y, w, ph);
    text(ctx, 'THE PARTY', pad + 14, y + 18, { size: 9, color: COLORS.faint });
    people.forEach((p, i) => {
      const cls = CLASSES[p.adv.classId] || {};
      const py = y + 38 + i * 32;
      text(ctx, p.adv.name, pad + 14, py, {
        size: 12,
        color: p.lost ? '#a66a70' : COLORS.ink,
        font: FONT_DISPLAY,
      });
      const detail = p.lost
        ? `${cls.name} L${p.adv.level} · ${p.adv.deathRoom ? p.adv.deathRoom.name : 'the dark'}`
        : `${cls.name} L${p.adv.level} · ${plural(p.adv.expeditions, 'run')}`;
      text(ctx, detail, pad + 14, py + 13, { size: 9, color: p.lost ? '#8a6066' : COLORS.dim });
      text(ctx, p.lost ? 'lost' : 'walked out', pad + w - 14, py, {
        size: 10,
        color: p.lost ? '#d5646a' : '#9fd08a',
        align: 'right',
      });
    });
    y += ph + 10;

    // Haul
    const counts = {};
    for (const id of r.gear) counts[id] = (counts[id] || 0) + 1;
    const gearRows = Object.entries(counts);
    const hh = 26 + Math.max(1, gearRows.length) * 18;
    panel(ctx, pad, y, w, hh);
    text(ctx, 'HAUL', pad + 14, y + 18, { size: 9, color: COLORS.faint });
    if (!gearRows.length) {
      text(ctx, 'Coin only. Coin spends.', pad + 14, y + 36, { size: 11, color: COLORS.dim });
    } else {
      gearRows.forEach(([id, n], i) => {
        const gear = GEAR_BY_ID[id];
        if (!gear) return;
        text(ctx, `${gear.name}${n > 1 ? ` ×${n}` : ''}`, pad + 14, y + 36 + i * 18, {
          size: 11,
          color: GRADE_COLOR[gear.grade],
        });
      });
    }
    y += hh + 10;

    // Chronicle
    const tail = this.chronicleTail();
    const lineSets = tail.map((e) => ({ entry: e, lines: wrap(ctx, e.text, w - 28, { size: 11 }) }));
    const ch = 30 + lineSets.reduce((a, l) => a + l.lines.length * 14 + 4, 0);
    panel(ctx, pad, y, w, ch);
    text(ctx, 'FROM THE CHRONICLE', pad + 14, y + 18, { size: 9, color: COLORS.faint });
    let ly = y + 36;
    for (const set of lineSets) {
      set.lines.forEach((line, i) =>
        text(ctx, line, pad + 14, ly + i * 14, { size: 11, color: LOG_COLOR[set.entry.kind] || LOG_COLOR.plain }),
      );
      ly += set.lines.length * 14 + 4;
    }
    y += ch + 10;

    ctx.restore();
    this.scrollMax = Math.max(0, y + this.scroll - bottom);
    this.scroll = clamp(this.scroll, 0, this.scrollMax);
    if (this.scrollMax > 0) {
      text(ctx, 'scroll for more', W / 2, bottom + 4, { align: 'center', size: 9, color: COLORS.faint });
    }
  }

  // --- wide ----------------------------------------------------------------

  drawWide(ctx, W, H) {
    const r = this.results;
    const stats = this.stats();
    const boxW = Math.min(300, (W - 120) / 3);
    const gap = 24;
    const totalW = boxW * 3 + gap * 2;
    const left = (W - totalW) / 2;

    panel(ctx, left, 116, boxW, 176);
    stats.forEach((s, i) => {
      text(ctx, s[0], left + 16, 142 + i * 26, { size: 11, color: COLORS.dim });
      text(ctx, s[1], left + boxW - 16, 142 + i * 26, { size: 13, color: s[2], align: 'right', weight: 'bold' });
    });
    if (r.biomes.length) {
      panel(ctx, left, 302, boxW, 30 + r.biomes.length * 16);
      text(ctx, 'BIOMES FORMED', left + 16, 322, { size: 9, color: COLORS.faint });
      r.biomes.forEach((b, i) => text(ctx, b, left + 16, 340 + i * 16, { size: 11, color: COLORS.violet }));
    }

    const px = left + boxW + gap;
    panel(ctx, px, 116, boxW, 260);
    text(ctx, 'THE PARTY', px + 16, 138, { size: 9, color: COLORS.faint });
    let y = 158;
    for (const adv of r.survivors) {
      const cls = CLASSES[adv.classId] || {};
      text(ctx, adv.name, px + 16, y, { size: 12, color: COLORS.ink, font: FONT_DISPLAY });
      text(ctx, `${cls.name} L${adv.level} · ${plural(adv.expeditions, 'run')}`, px + 16, y + 13, {
        size: 9,
        color: COLORS.dim,
      });
      text(ctx, 'walked out', px + boxW - 16, y, { size: 10, color: '#9fd08a', align: 'right' });
      y += 32;
    }
    for (const adv of r.dead) {
      const cls = CLASSES[adv.classId] || {};
      text(ctx, adv.name, px + 16, y, { size: 12, color: '#a66a70', font: FONT_DISPLAY });
      text(ctx, `${cls.name} L${adv.level} · ${adv.deathRoom ? adv.deathRoom.name : 'the dark'}`, px + 16, y + 13, {
        size: 9,
        color: '#8a6066',
      });
      text(ctx, 'lost', px + boxW - 16, y, { size: 10, color: '#d5646a', align: 'right' });
      y += 32;
    }

    const hx = px + boxW + gap;
    panel(ctx, hx, 116, boxW, 260);
    text(ctx, 'HAUL', hx + 16, 138, { size: 9, color: COLORS.faint });
    if (!r.gear.length) {
      text(ctx, 'Coin only. Coin spends.', hx + 16, 160, { size: 11, color: COLORS.dim });
    } else {
      const counts = {};
      for (const id of r.gear) counts[id] = (counts[id] || 0) + 1;
      Object.entries(counts).forEach(([id, n], i) => {
        const gear = GEAR_BY_ID[id];
        if (!gear) return;
        text(ctx, `${gear.name}${n > 1 ? ` ×${n}` : ''}`, hx + 16, 160 + i * 18, {
          size: 11,
          color: GRADE_COLOR[gear.grade],
        });
      });
    }

    const boxY = Math.min(396, H - 196);
    panel(ctx, left, boxY, totalW, H - boxY - 62);
    text(ctx, 'FROM THE CHRONICLE', left + 16, boxY + 22, { size: 9, color: COLORS.faint });
    let ly = boxY + 42;
    for (const entry of this.chronicleTail()) {
      const lines = wrap(ctx, entry.text, totalW - 40, { size: 11 });
      if (ly + lines.length * 14 > H - 70) break;
      lines.forEach((line, i) =>
        text(ctx, line, left + 16, ly + i * 14, { size: 11, color: LOG_COLOR[entry.kind] || LOG_COLOR.plain }),
      );
      ly += lines.length * 14 + 4;
    }
  }
}
