// The debrief. What you came back with, who did not, and the line the guild
// will repeat about it for the next month.

import { CLASSES } from '../data/classes.js';
import { GEAR_BY_ID, GRADE_COLOR } from '../data/equipment.js';
import { formatTime, plural } from '../core/util.js';
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

  onKeyDown(code) {
    if (code === 'Enter' || code === 'Space' || code === 'Escape') this.app.openGuild();
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

    text(ctx, info.label.toUpperCase(), W / 2, 64, {
      align: 'center',
      size: 38,
      color: info.color,
      font: FONT_DISPLAY,
    });
    text(ctx, info.sub, W / 2, 88, { align: 'center', size: 12, color: COLORS.dim });

    // Numbers
    const stats = [
      ['Gold recovered', `${r.gold}`, COLORS.gold],
      ['Rooms built', `${r.rooms}`, COLORS.ink],
      ['Deepest room', `${r.depth}`, COLORS.violet],
      ['Killed', `${r.kills}${r.eliteKills ? ` (${r.eliteKills} elite)` : ''}`, COLORS.blood],
      ['Final Threat', `${r.threat}`, '#ff9a4a'],
      ['Time below', formatTime(r.duration), COLORS.dim],
    ];
    const boxW = 300;
    panel(ctx, 40, 116, boxW, 176);
    stats.forEach((s, i) => {
      text(ctx, s[0], 56, 142 + i * 26, { size: 11, color: COLORS.dim });
      text(ctx, s[1], 40 + boxW - 16, 142 + i * 26, { size: 13, color: s[2], align: 'right', weight: 'bold' });
    });

    if (r.biomes.length) {
      panel(ctx, 40, 302, boxW, 30 + r.biomes.length * 16);
      text(ctx, 'BIOMES FORMED', 56, 322, { size: 9, color: COLORS.faint });
      r.biomes.forEach((b, i) => text(ctx, b, 56, 340 + i * 16, { size: 11, color: COLORS.violet }));
    }

    // People
    const px = 364;
    panel(ctx, px, 116, 300, 260);
    text(ctx, 'THE PARTY', px + 16, 138, { size: 9, color: COLORS.faint });
    let y = 158;
    for (const adv of r.survivors) {
      const cls = CLASSES[adv.classId] || {};
      text(ctx, adv.name, px + 16, y, { size: 12, color: COLORS.ink, font: FONT_DISPLAY });
      text(ctx, `${cls.name} L${adv.level} · ${plural(adv.expeditions, 'run')}`, px + 16, y + 13, {
        size: 9,
        color: COLORS.dim,
      });
      text(ctx, 'walked out', px + 284, y, { size: 10, color: '#9fd08a', align: 'right' });
      y += 32;
    }
    for (const adv of r.dead) {
      const cls = CLASSES[adv.classId] || {};
      text(ctx, adv.name, px + 16, y, { size: 12, color: '#a66a70', font: FONT_DISPLAY });
      text(ctx, `${cls.name} L${adv.level} · ${adv.deathRoom ? adv.deathRoom.name : 'the dark'}`, px + 16, y + 13, {
        size: 9,
        color: '#8a6066',
      });
      text(ctx, 'lost', px + 284, y, { size: 10, color: '#d5646a', align: 'right' });
      y += 32;
    }

    // Haul
    const hx = 688;
    panel(ctx, hx, 116, W - hx - 40, 260);
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

    // The last words of the chronicle — the parts worth repeating, not the
    // housekeeping.
    const boxY = 396;
    panel(ctx, 40, boxY, W - 80, H - boxY - 62);
    text(ctx, 'FROM THE CHRONICLE', 56, boxY + 22, { size: 9, color: COLORS.faint });
    const interesting = ['good', 'bad', 'loot', 'biome', 'boss', 'death'];
    const pool = (r.chronicle || []).filter((e) => interesting.includes(e.kind));
    const tail = (pool.length >= 3 ? pool : (r.chronicle || []).filter((e) => e.kind !== 'bark')).slice(-7);
    let ly = boxY + 42;
    for (const entry of tail) {
      const lines = wrap(ctx, entry.text, W - 120, { size: 11 });
      if (ly + lines.length * 14 > H - 70) break;
      lines.forEach((line, i) =>
        text(ctx, line, 56, ly + i * 14, { size: 11, color: LOG_COLOR[entry.kind] || LOG_COLOR.plain }),
      );
      ly += lines.length * 14 + 4;
    }

    this.buttons.back = { x: W / 2 - 100, y: H - 46, w: 200, h: 32 };
    button(ctx, this.buttons.back, 'Back to the Guild', {
      hover: this.hover === 'back',
      size: 13,
      font: FONT_DISPLAY,
    });
  }
}
