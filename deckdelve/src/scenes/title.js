// Title screen. A slow drift of room cards falling into place behind the name.

import { CARDS } from '../data/cards.js';
import { drawCard } from '../render/cards.js';
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
        x: Math.random() * app.width,
        y: Math.random() * app.height,
        vy: 8 + Math.random() * 16,
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
      if (c.y > this.app.height + 120) {
        c.y = -140;
        c.x = Math.random() * this.app.width;
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
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#14111d');
    g.addColorStop(0.55, '#0d0c14');
    g.addColorStop(1, '#080710');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const c of this.cards) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.scale(c.scale, c.scale);
      drawCard(ctx, { x: -48, y: -62, w: 96, h: 124 }, { card: c.card }, { showBlurb: false });
      ctx.restore();
    }

    vignette(ctx, W, H, 0.7);

    const cx = W / 2;
    text(ctx, 'DECKDELVE', cx, H * 0.3, {
      align: 'center',
      size: 62,
      color: '#e8d9b4',
      font: FONT_DISPLAY,
      shadowBlur: 18,
    });
    text(ctx, 'build the dungeon · then send them in', cx, H * 0.3 + 30, {
      align: 'center',
      size: 15,
      color: COLORS.gold,
      font: FONT_DISPLAY,
    });

    const blurb =
      'You are not the hero. You are the one dealing out rooms, one card at a time, ' +
      'while four hired adventurers walk into whatever you just built.';
    wrap(ctx, blurb, 520, { size: 12 }).forEach((line, i) =>
      text(ctx, line, cx, H * 0.42 + i * 18, { align: 'center', size: 12, color: COLORS.dim }),
    );

    this.buttons.play = { x: cx - 110, y: H * 0.58, w: 220, h: 44 };
    button(ctx, this.buttons.play, this.hasSave ? 'Return to the Guild' : 'Open the Guild Hall', {
      hover: this.hover === 'play',
      size: 15,
      font: FONT_DISPLAY,
    });
    if (this.hasSave) {
      this.buttons.fresh = { x: cx - 90, y: H * 0.58 + 56, w: 180, h: 28 };
      button(ctx, this.buttons.fresh, 'Start a new guild', { hover: this.hover === 'fresh', size: 11 });
    }

    text(ctx, 'press Enter', cx, H - 24, { align: 'center', size: 10, color: COLORS.faint });
  }
}
