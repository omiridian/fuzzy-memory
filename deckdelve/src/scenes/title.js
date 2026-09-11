// Title screen. A slow drift of room cards falling into place behind the name.

import { CARDS } from '../data/cards.js';
import { drawCard } from '../render/cards.js';
import { clamp } from '../core/util.js';
import { COLORS, FONT_DISPLAY, button, hit, text, vignette, wrap } from '../render/ui.js';

export class TitleScene {
  constructor(app, { hasSave }) {
    this.app = app;
    this.hasSave = hasSave;
    this.time = 0;
    this.hover = null;
    this.cards = [];
    for (let i = 0; i < 14; i++) {
      this.cards.push({
        card: CARDS[Math.floor(Math.random() * CARDS.length)],
        x: Math.random(),
        y: Math.random(),
        vy: 0.012 + Math.random() * 0.02,
        rot: (Math.random() - 0.5) * 0.5,
        spin: (Math.random() - 0.5) * 0.12,
        scale: 0.5 + Math.random() * 0.5,
        alpha: 0.12 + Math.random() * 0.16,
      });
    }
    this.buttons = {};
  }

  update(dt) {
    this.time += dt;
    for (const c of this.cards) {
      c.y += c.vy * dt;
      c.rot += c.spin * dt;
      if (c.y > 1.2) {
        c.y = -0.2;
        c.x = Math.random();
      }
    }
  }

  onPointerMove(x, y) {
    this.hover = null;
    for (const key in this.buttons) {
      if (hit(this.buttons[key], x, y)) this.hover = key;
    }
  }

  onPointerDown(x, y) {
    for (const key in this.buttons) {
      if (hit(this.buttons[key], x, y)) this.activate(key);
    }
  }

  onKeyDown(code) {
    if (code === 'Enter' || code === 'Space') this.activate('play');
  }

  activate(key) {
    if (key === 'play') this.app.openGuild();
    if (key === 'fresh') this.app.newGame();
  }

  draw(ctx) {
    const W = this.app.width;
    const H = this.app.height;
    const compact = this.app.compact;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#14111d');
    g.addColorStop(0.55, '#0d0c14');
    g.addColorStop(1, '#080710');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const c of this.cards) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(c.x * W, c.y * H);
      ctx.rotate(c.rot);
      ctx.scale(c.scale, c.scale);
      drawCard(ctx, { x: -48, y: -62, w: 96, h: 124 }, { card: c.card }, { showBlurb: false });
      ctx.restore();
    }

    vignette(ctx, W, H, 0.7);

    const cx = W / 2;
    const titleSize = clamp(W * 0.078, 30, 62);
    text(ctx, 'DECKDELVE', cx, H * 0.28, {
      align: 'center',
      size: titleSize,
      color: '#e8d9b4',
      font: FONT_DISPLAY,
      shadowBlur: 18,
    });
    text(ctx, 'build the dungeon · then send them in', cx, H * 0.28 + titleSize * 0.5, {
      align: 'center',
      size: clamp(W * 0.03, 11, 15),
      color: COLORS.gold,
      font: FONT_DISPLAY,
    });

    const blurb =
      'You are not the hero. You are the one dealing out rooms, one card at a time, ' +
      'while four hired adventurers walk into whatever you just built.';
    const blurbW = Math.min(520, W - 48);
    wrap(ctx, blurb, blurbW, { size: 12 }).forEach((line, i) =>
      text(ctx, line, cx, H * 0.44 + i * 18, { align: 'center', size: 12, color: COLORS.dim }),
    );

    const bw = Math.min(260, W - 60);
    const bh = compact ? 50 : 44;
    this.buttons.play = { x: cx - bw / 2, y: H * 0.6, w: bw, h: bh };
    button(ctx, this.buttons.play, this.hasSave ? 'Return to the Guild' : 'Open the Guild Hall', {
      hover: this.hover === 'play',
      size: 15,
      font: FONT_DISPLAY,
    });
    if (this.hasSave) {
      this.buttons.fresh = { x: cx - bw / 2 + 30, y: H * 0.6 + bh + 14, w: bw - 60, h: compact ? 38 : 28 };
      button(ctx, this.buttons.fresh, 'Start a new guild', { hover: this.hover === 'fresh', size: 11 });
    }

    text(ctx, this.app.touching ? 'tap to begin' : 'press Enter', cx, H - 22, {
      align: 'center',
      size: 10,
      color: COLORS.faint,
    });
  }
}
