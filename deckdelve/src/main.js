// Boot: the canvas, the input map, the scene stack, and the glue between the
// guild hall and whatever is about to happen underneath it.

import { RNG } from './core/rng.js';
import { loadGuild, newGuild, saveGuild, applyResults, partyMembers, wipeSave } from './systems/guild.js';
import { TitleScene } from './scenes/title.js';
import { GuildScene } from './scenes/guild.js';
import { ExpeditionScene } from './scenes/expedition.js';
import { ResultsScene } from './scenes/results.js';
import { COLORS, text } from './render/ui.js';

const LOGICAL_WIDTH = 1024;
const LOGICAL_HEIGHT = 640;

class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = LOGICAL_WIDTH;
    this.height = LOGICAL_HEIGHT;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.keys = {};
    this.scene = null;
    this.rng = new RNG(Date.now());
    this.rawDt = 0.016;
    this.error = null;

    this.guild = loadGuild();
    if (!this.guild) this.guild = newGuild(this.rng);

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setScene(new TitleScene(this, { hasSave: !!loadGuild() }));
    requestAnimationFrame((t) => this.loop(t));
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = window.innerWidth;
    const availH = window.innerHeight;
    const scale = Math.min(availW / LOGICAL_WIDTH, availH / LOGICAL_HEIGHT);
    const cssW = Math.floor(LOGICAL_WIDTH * scale);
    const cssH = Math.floor(LOGICAL_HEIGHT * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.scale = scale;
    this.dpr = dpr;
    const rect = this.canvas.getBoundingClientRect();
    this.offsetX = rect.left;
    this.offsetY = rect.top;
  }

  toLogical(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / this.scale,
      y: (event.clientY - rect.top) / this.scale,
    };
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers refuse capture for synthetic pointers; harmless */
      }
      const p = this.toLogical(e);
      this.call('onPointerMove', p.x, p.y);
      this.call('onPointerDown', p.x, p.y, e.button);
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.toLogical(e);
      this.call('onPointerMove', p.x, p.y);
    });
    c.addEventListener('pointerup', (e) => {
      const p = this.toLogical(e);
      this.call('onPointerUp', p.x, p.y, e.button);
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.toLogical(e);
        this.call('onWheel', e.deltaY, p.x, p.y);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys[e.code] = true;
      this.call('onKeyDown', e.code, e);
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  call(method, ...args) {
    const scene = this.scene;
    if (scene && typeof scene[method] === 'function') {
      try {
        scene[method](...args);
      } catch (err) {
        this.fail(err);
      }
    }
  }

  fail(err) {
    // Better a legible message on the canvas than a silent black rectangle.
    console.error(err);
    this.error = err;
  }

  setScene(scene) {
    this.scene = scene;
  }

  loop(timestamp) {
    const last = this.lastTime || timestamp;
    let dt = (timestamp - last) / 1000;
    this.lastTime = timestamp;
    if (!Number.isFinite(dt)) dt = 0;
    dt = Math.min(dt, 0.05);
    this.rawDt = dt;

    if (!this.error) {
      this.call('update', dt);
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      try {
        if (this.scene) this.scene.draw(ctx);
      } catch (err) {
        this.fail(err);
      }
      ctx.restore();
    } else {
      this.drawError();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  drawError() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
    ctx.fillStyle = '#140d12';
    ctx.fillRect(0, 0, this.width, this.height);
    text(ctx, 'Something in the dungeon broke.', this.width / 2, this.height / 2 - 20, {
      align: 'center',
      size: 20,
      color: '#d5646a',
    });
    text(ctx, String(this.error && this.error.message), this.width / 2, this.height / 2 + 8, {
      align: 'center',
      size: 12,
      color: COLORS.dim,
    });
    text(ctx, 'Reload the page to start again.', this.width / 2, this.height / 2 + 32, {
      align: 'center',
      size: 11,
      color: COLORS.faint,
    });
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  save() {
    saveGuild(this.guild);
  }

  newGame() {
    wipeSave();
    this.guild = newGuild(this.rng);
    this.save();
    this.openGuild();
  }

  openTitle() {
    this.setScene(new TitleScene(this, { hasSave: true }));
  }

  openGuild() {
    this.save();
    this.setScene(new GuildScene(this, { guild: this.guild, rng: this.rng }));
  }

  startExpedition() {
    const roster = partyMembers(this.guild);
    const deckCards = this.guild.deck.slice();
    const rng = new RNG(this.rng.int(0, 0xffffffff));
    this.setScene(
      new ExpeditionScene(this, {
        rng,
        roster,
        deckCards,
        guild: this.guild,
      }),
    );
  }

  onExpeditionFinished(results) {
    applyResults(this.guild, results, this.rng);
    this.save();
    this.setScene(new ResultsScene(this, { results, guild: this.guild }));
  }
}

const canvas = document.getElementById('game');
if (canvas) {
  window.deckdelve = new App(canvas);
}

export { App };
