// Boot: the canvas, the input map, the scene stack, and the glue between the
// guild hall and whatever is about to happen underneath it.
//
// The game is drawn in its own coordinate space and scaled to fill whatever
// screen it is given. That space is not fixed: a phone held upright gets a tall,
// narrow one with thumb-sized controls, a desktop gets a wide one. Scenes ask
// the app for `width`, `height` and `compact` and lay themselves out to suit.

import { RNG } from './core/rng.js';
import { Gestures, logicalSize } from './core/gestures.js';
import { applyResults, newGuild, partyMembers, wipeSave } from './systems/guild.js';
import { SaveSlot } from './systems/saves.js';
import { TitleScene } from './scenes/title.js';
import { GuildScene } from './scenes/guild.js';
import { ExpeditionScene } from './scenes/expedition.js';
import { ResultsScene } from './scenes/results.js';
import { COLORS, text } from './render/ui.js';

class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1024;
    this.height = 640;
    this.compact = false;
    this.scale = 1;
    this.dpr = 1;
    this.keys = {};
    this.scene = null;
    this.rng = new RNG(Date.now());
    this.rawDt = 0.016;
    this.error = null;

    this.saves = new SaveSlot();
    const saved = this.saves.read();
    this.hadSave = !!saved;
    this.guild = saved || newGuild(this.rng);

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());

    this.setScene(new TitleScene(this, { hasSave: this.hadSave }));
    requestAnimationFrame((t) => this.loop(t));
  }

  get touching() {
    return this.gestures ? this.gestures.touching : false;
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  resize() {
    const vw = Math.max(240, window.innerWidth);
    const vh = Math.max(240, window.innerHeight);
    const size = logicalSize(vw, vh);
    this.width = size.w;
    this.height = size.h;
    this.compact = size.compact;
    this.scale = vw / size.w;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.style.width = `${vw}px`;
    this.canvas.style.height = `${Math.round(size.h * this.scale)}px`;
    this.canvas.width = Math.round(vw * this.dpr);
    this.canvas.height = Math.round(size.h * this.scale * this.dpr);
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
    this.gestures = new Gestures({
      move: (x, y) => this.call('onPointerMove', x, y),
      press: (x, y, button) => this.call('onPointerDown', x, y, button),
      release: (x, y, button) => this.call('onPointerUp', x, y, button),
      panStart: (x, y) => {
        const scene = this.scene;
        return scene && scene.onDragStart ? scene.onDragStart(x, y) : null;
      },
      pan: (dx, dy, kind) => {
        const scene = this.scene;
        if (!scene) return;
        if (kind === 'scroll' && scene.onDragScroll) scene.onDragScroll(dy / this.scale);
        else if (scene.onDragPan) scene.onDragPan(dx / this.scale, dy / this.scale);
      },
      zoom: (factor, x, y) => this.call('onZoom', factor, x, y),
      longPressStart: () => {
        if (navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch {
            /* some browsers refuse; it is only a nicety */
          }
        }
      },
    });

    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers refuse capture for synthetic pointers; harmless */
      }
      const p = this.toLogical(e);
      this.gestures.down(e.pointerId, p.x, p.y, e.button, e.pointerType !== 'mouse');
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.toLogical(e);
      this.gestures.move(e.pointerId, p.x, p.y);
    });
    const release = (e) => {
      const p = this.toLogical(e);
      this.gestures.up(e.pointerId, p.x, p.y, e.button);
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', (e) => this.gestures.cancel(e.pointerId));
    c.addEventListener('lostpointercapture', (e) => this.gestures.cancel(e.pointerId));

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
      size: 18,
      color: '#d5646a',
    });
    text(ctx, String(this.error && this.error.message), this.width / 2, this.height / 2 + 8, {
      align: 'center',
      size: 11,
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
    this.saves.write(this.guild);
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
    this.setScene(new ExpeditionScene(this, { rng, roster, deckCards, guild: this.guild }));
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
