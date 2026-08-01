// Title screen: new game, continue, and the naming prompt.

import { ListMenu, panel, text, COLORS, paragraph } from '../render/ui.js';
import { drawCreature } from '../render/sprites.js';
import { STARTER_IDS } from '../data/species.js';
import { Game } from '../systems/game.js';
import { formatPlayTime } from '../core/util.js';

export class TitleScene {
  constructor(app) {
    this.app = app;
    this.time = 0;
    this.hasSave = Game.hasSave();
    const options = [];
    if (this.hasSave) options.push({ label: 'Continue', value: 'continue' });
    options.push({ label: 'New Game', value: 'new' });
    options.push({ label: 'Controls', value: 'help' });
    this.menu = new ListMenu(options, {
      visible: options.length,
      onSelect: (item) => this.select(item.value),
    });
    this.showHelp = false;
    this.saveInfo = null;
    if (this.hasSave) {
      const loaded = Game.load();
      if (loaded) {
        this.saveInfo = {
          name: loaded.playerName,
          time: loaded.playTime,
          caught: loaded.caughtCount(),
          map: loaded.mapId,
        };
      }
    }
  }

  select(value) {
    if (value === 'continue') {
      const game = Game.load();
      if (game) this.app.beginGame(game);
      return;
    }
    if (value === 'new') {
      const name = this.app.prompt('What should everyone call you?', 'Wren');
      if (name === null) return;
      const game = new Game({ playerName: (name || 'Wren').slice(0, 12) });
      game.quests.startAuto();
      this.app.beginGame(game);
      return;
    }
    this.showHelp = !this.showHelp;
  }

  handleInput(key, down) {
    if (!down) return;
    if (this.showHelp && (key === 'cancel' || key === 'confirm')) {
      this.showHelp = false;
      return;
    }
    this.menu.handle(key);
  }

  update(dt) {
    this.time += dt;
  }

  render(ctx) {
    const w = this.app.width;
    const h = this.app.height;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#1a1330');
    grd.addColorStop(0.6, '#2a1f45');
    grd.addColorStop(1, '#0f1220');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Drifting Weave threads.
    ctx.strokeStyle = 'rgba(200,180,255,0.18)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const y = h * 0.2 + i * 26 + Math.sin(x * 0.01 + this.time * 0.6 + i) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    STARTER_IDS.forEach((id, i) => {
      drawCreature(ctx, id, w / 2 + (i - 1) * 150, h - 70, 110 + Math.sin(this.time + i) * 3);
    });

    text(ctx, 'AETHERLINGS', w / 2, 56, { size: 42, align: 'center', color: '#f0e0a0', weight: 'bold' });
    text(ctx, 'a Weave is only as strong as who holds it', w / 2, 106, {
      size: 14,
      align: 'center',
      color: '#b8aed0',
    });

    const mw = 240;
    panel(ctx, w / 2 - mw / 2, 150, mw, 40 + this.menu.items.length * 28);
    this.menu.render(ctx, w / 2 - mw / 2 + 24, 172, mw - 48, { lineHeight: 28, size: 16 });

    if (this.saveInfo) {
      text(
        ctx,
        `${this.saveInfo.name} · ${formatPlayTime(this.saveInfo.time)} · ${this.saveInfo.caught} recorded`,
        w / 2,
        150 + 48 + this.menu.items.length * 28,
        { size: 11, align: 'center', color: COLORS.textDim }
      );
    }

    if (this.showHelp) {
      const bw = 420;
      const bh = 200;
      panel(ctx, w / 2 - bw / 2, h / 2 - bh / 2, bw, bh);
      text(ctx, 'Controls', w / 2 - bw / 2 + 20, h / 2 - bh / 2 + 16, { size: 16, color: COLORS.accent });
      paragraph(
        ctx,
        'Arrows or WASD to walk.\nZ or Enter to talk and confirm.\nX or Escape to go back.\nM opens the menu (and reorders your team).\nShift to run.\n\nSave often — the world does not.',
        w / 2 - bw / 2 + 20,
        h / 2 - bh / 2 + 44,
        bw - 40,
        { size: 13 }
      );
    }
  }
}
