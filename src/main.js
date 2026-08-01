// Boot code: the canvas, the input map, the scene stack and the glue between
// the overworld, battles and menus.

import { TitleScene } from './scenes/title.js';
import { OverworldScene } from './scenes/overworld.js';
import { BattleScene } from './scenes/battle.js';
import {
  PauseMenu, PartyScene, ShopScene, StorageScene, ChoiceScene, MoveLearnerScene, EvolutionScene,
} from './scenes/menus.js';
import { Battle } from './battle/engine.js';
import { buildTrainerTeam } from './systems/trainers.js';
import { Game } from './systems/game.js';
import { refreshStats } from './systems/monster.js';
import { prepareAllMaps } from './world/world.js';
import { MOVES } from './data/moves.js';
import { labelTomes } from './data/items.js';
import { RNG } from './core/rng.js';
import { panel, text, COLORS } from './render/ui.js';

const KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'confirm',
  Enter: 'confirm',
  Space: 'confirm',
  KeyX: 'cancel',
  Escape: 'cancel',
  KeyM: 'menu',
  Tab: 'menu',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.scenes = [];
    this.game = null;
    this.dt = 0;
    this.busy = false;
    this.fadeState = null;
    this.toast = null;
    this.toastTimer = 0;
    this.input = { held: {}, };
    this.bindInput();
  }

  // ── Scene stack ──────────────────────────────────────────────────────────
  push(scene) {
    this.scenes.push(scene);
    return scene;
  }

  pop() {
    return this.scenes.pop();
  }

  replace(scene) {
    this.scenes = [scene];
    return scene;
  }

  get top() {
    return this.scenes[this.scenes.length - 1];
  }

  // ── Input ────────────────────────────────────────────────────────────────
  bindInput() {
    window.addEventListener('keydown', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.input.held[action]) {
        this.input.held[action] = true;
        if (this.top && this.top.handleInput) this.top.handleInput(action, true);
      }
    });
    window.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      e.preventDefault();
      this.input.held[action] = false;
      if (this.top && this.top.handleInput) this.top.handleInput(action, false);
    });
    window.addEventListener('blur', () => {
      this.input.held = {};
    });
  }

  prompt(message, initial = '') {
    // eslint-disable-next-line no-alert
    return window.prompt(message, initial);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  beginGame(game) {
    this.game = game;
    game.quests.startAuto();
    prepareAllMaps();
    if (!game.getFlag('chose_starter') && game.mapId === 'player_home') {
      game.mapId = 'player_home';
    }
    const overworld = new OverworldScene(this);
    this.overworld = overworld;
    this.replace(overworld);
    this.notify(`Welcome, ${game.playerName}.`);
  }

  saveGame() {
    if (!this.game) return;
    const ok = this.game.save();
    this.notify(ok ? 'Game saved.' : 'Could not save — storage is unavailable.');
  }

  notify(message) {
    this.toast = message;
    this.toastTimer = 2.6;
  }

  fade(midpoint) {
    this.fadeState = { t: 0, midpoint, done: false };
    this.busy = true;
  }

  warpTo(spot) {
    this.fade(() => {
      this.overworld.enterMap(spot.map, spot.x, spot.y);
    });
  }

  // ── Scene factories used by the overworld and scripts ────────────────────
  makeMenuScene() {
    return new PauseMenu(this);
  }

  makeShopScene(stock) {
    return new ShopScene(this, stock);
  }

  makeStorageScene() {
    return new StorageScene(this);
  }

  pushChoice(opts) {
    this.push(new ChoiceScene(this, opts));
  }

  pushPartyPicker(opts) {
    this.push(
      new PartyScene(this, {
        party: opts.party || this.game.party.mons,
        title: opts.title,
        onSelect: opts.onSelect,
        onCancel: opts.onCancel,
      })
    );
  }

  pushMoveLearner(mon, moveId, opts) {
    this.push(new MoveLearnerScene(this, mon, moveId, opts));
  }

  beginEvolution(mon, evo, onDone) {
    this.push(new EvolutionScene(this, mon, evo, onDone));
  }

  // ── Battles ──────────────────────────────────────────────────────────────
  startBattle(opts) {
    const game = this.game;
    const foeParty = opts.foeParty || buildTrainerTeam(opts.trainer);
    for (const mon of foeParty) game.recordSeen(mon.species);
    const battle = new Battle({
      playerParty: game.party.mons,
      foeParty,
      isWild: !!opts.isWild,
      trainer: opts.trainer || null,
      bag: game.bag,
      rng: new RNG(game.rng.int(0, 0xffffffff)),
      environment: opts.environment || 'grass',
      isNight: game.isNight,
      playerName: game.playerName,
      canFlee: opts.canFlee !== undefined ? opts.canFlee : !!opts.isWild,
      canCatch: opts.canCatch !== undefined ? opts.canCatch : !!opts.isWild,
    });
    this.battleOpts = opts;
    this.fade(() => {
      this.push(new BattleScene(this, battle, opts));
    });
  }

  endBattle(result) {
    this.fade(() => {
      // Drop the battle scene and anything it stacked on top.
      while (this.top && this.top !== this.overworld) this.pop();
      if (result.outcome === 'victory' && result.onVictory) result.onVictory();
      this.overworld.onBattleEnd(result);
      this.checkEvolutions();
    });
  }

  /** Walks the party through any evolutions triggered by the last battle. */
  checkEvolutions() {
    const pending = this.game.pendingEvolutions('level');
    if (!pending.length) return;
    const step = (index) => {
      if (index >= pending.length) return;
      const { mon, evo } = pending[index];
      this.beginEvolution(mon, evo, () => step(index + 1));
    };
    step(0);
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  update(dt) {
    this.dt = dt;
    if (this.fadeState) {
      this.fadeState.t += dt * 2.4;
      if (!this.fadeState.done && this.fadeState.t >= 1) {
        this.fadeState.done = true;
        const fn = this.fadeState.midpoint;
        if (fn) fn();
      }
      if (this.fadeState.t >= 2) {
        this.fadeState = null;
        this.busy = false;
      }
    }
    if (this.toastTimer > 0) this.toastTimer -= dt;
    const top = this.top;
    if (top && top.update) top.update(dt);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    // Render the scene below when the top one is an overlay.
    const top = this.top;
    if (top && top.renderBelow && top.renderBelow() && this.scenes.length > 1) {
      const below = this.scenes[this.scenes.length - 2];
      if (below.render) below.render(ctx);
    }
    if (top && top.render) top.render(ctx);

    if (this.toastTimer > 0 && this.toast) {
      const alpha = Math.min(1, this.toastTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      panel(ctx, this.width / 2 - 150, 8, 300, 30, { radius: 4 });
      text(ctx, this.toast, this.width / 2, 16, { size: 13, align: 'center', color: COLORS.accent });
      ctx.restore();
    }

    if (this.fadeState) {
      const t = this.fadeState.t;
      const alpha = t <= 1 ? t : 2 - t;
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, alpha))})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
function boot() {
  const canvas = document.getElementById('game');
  labelTomes(MOVES);
  const app = new App(canvas);
  app.push(new TitleScene(app));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    app.update(dt);
    app.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Expose a little for debugging in the console.
  window.aetherlings = { app, Game, refresh: (mon) => refreshStats(mon, { healToFull: true }) };
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();
}

export { App };
