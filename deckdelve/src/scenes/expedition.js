// The play scene. Everything the player actually does happens here: holding a
// card, choosing where it goes, and then watching four people find out.

import { Expedition } from '../systems/expedition.js';
import { legalCells, worldToGrid } from '../systems/grid.js';
import { Camera } from '../render/view.js';
import { DungeonView } from '../render/dungeonview.js';
import { drawAdventurer, drawEnemy, drawFloaters, drawNameplate, drawParticles, drawProjectiles } from '../render/actors.js';
import {
  ORDERS, drawAdventurerTip, drawBiomeFlash, drawHandBar, drawHelp, drawLog, drawParty, drawTopBar, layoutFor,
} from '../render/hud.js';
import { COLORS, FONT_DISPLAY, hit, panel, text, vignette, wrap } from '../render/ui.js';
import { dist } from '../core/util.js';

const ORDER_KEYS = {
  KeyE: 'explore',
  KeyH: 'hold',
  KeyB: 'retreat',
  KeyV: 'rest',
  KeyC: 'interact',
};

export class ExpeditionScene {
  constructor(app, { rng, roster, deckCards, guild }) {
    this.app = app;
    this.guild = guild;
    this.exp = new Expedition({ rng, roster, deckCards, guild });
    this.exp.deck.drawTimer = guild.drawInterval || 9;
    this.layout = layoutFor(app.width, app.height);
    this.camera = new Camera(this.layout.map);
    this.view = new DungeonView();
    this.selection = [];
    this.heldCard = null;
    this.hoverCell = null;
    this.hoverInfo = null;
    this.legal = [];
    this.legalKey = '';
    this.pointer = { x: 0, y: 0, down: false, dragging: false, lastX: 0, lastY: 0 };
    this.hover = null;
    this.showHelp = false;
    this.hudRects = {};
    this.toast = null;
    this.toastTimer = 0;
    this.time = 0;
    this.endTimer = 0;

    if (guild.startBless) {
      for (const adv of this.exp.party) adv.statuses.push({ id: 'bless', duration: guild.startBless, power: 0.15 });
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  get selectedOrAll() {
    return this.selection.length ? this.selection.filter((a) => a.alive) : this.exp.living;
  }

  say(message) {
    this.toast = message;
    this.toastTimer = 2.6;
  }

  heldEntry() {
    return this.heldCard ? this.exp.deck.find(this.heldCard) : null;
  }

  refreshLegal() {
    const entry = this.heldEntry();
    if (!entry) {
      this.legal = [];
      this.legalKey = '';
      return;
    }
    const mask = this.exp.deck.doorsOf(entry);
    const key = `${entry.uid}:${mask}:${this.exp.graphVersion}`;
    if (key === this.legalKey) return;
    this.legalKey = key;
    this.legal = legalCells(this.exp.dungeon.rooms, mask);
  }

  selectAdventurer(adv, additive) {
    if (!additive) {
      for (const a of this.exp.party) a.selected = false;
      this.selection = [];
    }
    if (!adv) return;
    if (adv.selected) {
      adv.selected = false;
      this.selection = this.selection.filter((a) => a !== adv);
    } else {
      adv.selected = true;
      this.selection.push(adv);
    }
  }

  actorAt(world) {
    let best = null;
    let bestD = 18;
    for (const adv of this.exp.party) {
      if (!adv.alive) continue;
      const d = dist(world.x, world.y, adv.x, adv.y);
      if (d < bestD) {
        bestD = d;
        best = adv;
      }
    }
    return best;
  }

  enemyAt(world) {
    let best = null;
    let bestD = 20;
    for (const foe of this.exp.enemies) {
      if (!foe.alive) continue;
      const d = dist(world.x, world.y, foe.x, foe.y);
      if (d < bestD * (foe.scale || 1)) {
        bestD = d;
        best = foe;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  onPointerMove(x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
    if (this.pointer.down && this.pointer.panning) {
      this.camera.pan(this.pointer.lastX - x, this.pointer.lastY - y);
    }
    this.pointer.lastX = x;
    this.pointer.lastY = y;
    this.updateHover(x, y);
  }

  updateHover(x, y) {
    this.hover = null;
    this.hoverInfo = null;
    const L = this.layout;
    const R = this.hudRects;

    for (const name of ['extract', 'speed', 'pause', 'help']) {
      if (R.top && R.top[name] && hit(R.top[name], x, y)) this.hover = name;
    }
    if (R.party) {
      R.party.forEach((r, i) => {
        if (hit(r, x, y)) {
          this.hover = `party${i}`;
          this.hoverInfo = { kind: 'adventurer', adv: r.adv, x: r.x + r.w + 8, y: r.y };
        }
      });
    }
    if (R.hand) {
      R.hand.orderRects.forEach((r, i) => {
        if (hit(r, x, y)) {
          this.hover = `order${i}`;
          this.hoverInfo = { kind: 'text', title: r.order.label, body: r.order.blurb, x: r.x, y: r.y - 54 };
        }
      });
      R.hand.cardRects.forEach((r, i) => {
        if (hit(r, x, y)) {
          this.hover = `card${i}`;
          this.hoverInfo = {
            kind: 'text',
            title: r.entry.card.name,
            body: r.entry.card.blurb,
            x: Math.min(r.x, L.w - 250),
            y: r.y - 76,
          };
        }
      });
      if (R.hand.rotate && hit(R.hand.rotate, x, y)) this.hover = 'rotate';
      if (R.hand.mulligan && hit(R.hand.mulligan, x, y)) this.hover = 'mulligan';
    }

    if (hit(L.map, x, y)) {
      const world = this.camera.toWorld(x, y);
      this.hoverCell = worldToGrid(world.x, world.y);
      const foe = this.enemyAt(world);
      if (foe) {
        this.hoverInfo = {
          kind: 'text',
          title: foe.name,
          body: `${Math.ceil(foe.hp)}/${foe.maxHp} hp · ${foe.def.flavor || ''}`,
          x: Math.min(x + 12, L.w - 250),
          y: y + 12,
        };
      }
    } else {
      this.hoverCell = null;
    }
  }

  onPointerDown(x, y, button) {
    this.pointer.down = true;
    this.pointer.lastX = x;
    this.pointer.lastY = y;
    const L = this.layout;
    const R = this.hudRects;

    if (this.showHelp) {
      this.showHelp = false;
      return;
    }
    if (this.exp.outcome) return;

    if (button === 1) {
      this.pointer.panning = true;
      return;
    }

    // Top bar
    if (R.top) {
      if (hit(R.top.extract, x, y)) {
        if (this.exp.extracting) this.exp.cancelExtraction();
        else this.exp.beginExtraction();
        return;
      }
      if (hit(R.top.pause, x, y)) {
        this.exp.paused = !this.exp.paused;
        return;
      }
      if (hit(R.top.speed, x, y)) {
        this.exp.speed = this.exp.speed >= 3 ? 1 : this.exp.speed + 1;
        return;
      }
      if (hit(R.top.help, x, y)) {
        this.showHelp = true;
        return;
      }
    }

    // Party portraits
    if (R.party) {
      for (const r of R.party) {
        if (hit(r, x, y)) {
          this.selectAdventurer(r.adv, this.app.keys.ShiftLeft || this.app.keys.ShiftRight);
          return;
        }
      }
    }

    // Hand bar
    if (R.hand) {
      for (const r of R.hand.orderRects) {
        if (hit(r, x, y)) {
          this.applyOrder(r.order.id);
          return;
        }
      }
      for (const r of R.hand.cardRects) {
        if (hit(r, x, y)) {
          this.heldCard = this.heldCard === r.entry.uid ? null : r.entry.uid;
          this.refreshLegal();
          return;
        }
      }
      if (hit(R.hand.rotate, x, y)) {
        this.rotateHeld();
        return;
      }
      if (hit(R.hand.mulligan, x, y)) {
        this.mulliganHeld();
        return;
      }
    }

    if (!hit(L.map, x, y)) return;
    const world = this.camera.toWorld(x, y);

    if (button === 2) {
      const foe = this.enemyAt(world);
      if (foe) {
        this.exp.focusTarget(this.selectedOrAll, foe);
        this.say(`Focus: ${foe.name}`);
      } else {
        const room = this.exp.dungeon.atWorld(world.x, world.y);
        if (room && room.reachable) {
          this.exp.setOrder(this.selectedOrAll, 'rally', world);
          this.say(`Rallying to the ${room.name}.`);
        } else {
          this.say('There is nothing built there.');
        }
      }
      return;
    }

    // Placing a card
    const entry = this.heldEntry();
    if (entry) {
      const cell = worldToGrid(world.x, world.y);
      const result = this.exp.placeCard(entry.uid, cell.x, cell.y);
      if (result.ok) {
        this.heldCard = null;
        this.legalKey = '';
        this.camera.shake = 0.55;
      } else {
        this.say(result.reason);
      }
      return;
    }

    const adv = this.actorAt(world);
    this.selectAdventurer(adv, this.app.keys.ShiftLeft || this.app.keys.ShiftRight);
  }

  onPointerUp() {
    this.pointer.down = false;
    this.pointer.panning = false;
  }

  onWheel(delta, x, y) {
    this.camera.zoomBy(delta, { x, y });
  }

  onKeyDown(code) {
    if (this.exp.outcome) {
      if (code === 'Enter' || code === 'Space') this.finishToResults();
      return;
    }
    if (code === 'Escape') {
      if (this.showHelp) this.showHelp = false;
      else if (this.heldCard) this.heldCard = null;
      else this.selectAdventurer(null, false);
      return;
    }
    if (code.startsWith('Digit')) {
      const index = Number(code.slice(5)) - 1;
      const entry = this.exp.deck.hand[index];
      if (entry) {
        this.heldCard = this.heldCard === entry.uid ? null : entry.uid;
        this.refreshLegal();
      }
      return;
    }
    if (code === 'KeyR' || code === 'KeyQ') {
      if (this.heldCard) {
        this.rotateHeld(code === 'KeyQ' ? 3 : 1);
        return;
      }
    }
    if (ORDER_KEYS[code]) {
      this.applyOrder(ORDER_KEYS[code]);
      return;
    }
    if (code === 'Backquote') {
      for (const a of this.exp.party) a.selected = a.alive;
      this.selection = this.exp.living.slice();
      return;
    }
    if (code === 'KeyF') {
      this.camera.follow = !this.camera.follow;
      this.say(this.camera.follow ? 'Camera follows the party.' : 'Camera unlocked.');
      return;
    }
    if (code === 'Space') {
      this.exp.paused = !this.exp.paused;
      return;
    }
    if (code === 'Tab') {
      this.exp.speed = this.exp.speed >= 3 ? 1 : this.exp.speed + 1;
      return;
    }
    if (code === 'Slash') this.showHelp = !this.showHelp;
  }

  applyOrder(orderId) {
    const who = this.selectedOrAll;
    if (!who.length) return;
    if (orderId === 'rally') {
      this.say('Right-click on the map to rally there.');
      return;
    }
    this.exp.setOrder(who, orderId);
    const order = ORDERS.find((o) => o.id === orderId);
    this.say(`${who.length === this.exp.living.length ? 'Party' : `${who.length} of them`}: ${order.label}.`);
  }

  rotateHeld(turns = 1) {
    const entry = this.heldEntry();
    if (!entry) return;
    this.exp.deck.rotate(entry.uid, turns);
    this.legalKey = '';
    this.refreshLegal();
  }

  mulliganHeld() {
    const entry = this.heldEntry();
    if (!entry) return;
    this.exp.mulligan(entry.uid);
    this.heldCard = null;
    this.legalKey = '';
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  update(dt) {
    this.time += dt;
    const keys = this.app.keys;
    const panSpeed = 420 * dt;
    if (keys.KeyW || keys.ArrowUp) this.camera.pan(0, -panSpeed);
    if (keys.KeyS || keys.ArrowDown) this.camera.pan(0, panSpeed);
    if (keys.KeyA || keys.ArrowLeft) this.camera.pan(-panSpeed, 0);
    if (keys.KeyD || keys.ArrowRight) this.camera.pan(panSpeed, 0);

    const steps = this.exp.outcome ? 0 : this.exp.speed;
    for (let i = 0; i < steps; i++) this.exp.update(Math.min(dt, 0.05));

    this.camera.update(dt, this.exp.living.length ? this.exp.partyCentroid() : null);
    this.refreshLegal();

    if (this.toastTimer > 0) this.toastTimer -= dt;
    if (this.exp.outcome) {
      this.endTimer += dt;
      if (this.endTimer > 2.6) this.finishToResults();
    }
    // Selection housekeeping: the dead do not take orders.
    this.selection = this.selection.filter((a) => a.alive);
  }

  finishToResults() {
    if (this.handedOff) return;
    this.handedOff = true;
    this.app.onExpeditionFinished(this.exp.results || this.exp.finish('extracted'));
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  draw(ctx) {
    const L = this.layout;
    const exp = this.exp;

    ctx.fillStyle = '#08080c';
    ctx.fillRect(0, 0, L.w, L.h);

    this.camera.apply(ctx);
    this.view.drawRooms(ctx, exp, this.camera);
    this.view.drawRoomOverlays(ctx, exp, this.camera, this.app.rawDt || 0.016);

    if (this.heldCard) {
      this.view.drawLegalHints(ctx, this.legal);
      const entry = this.heldEntry();
      if (entry && this.hoverCell) {
        const mask = exp.deck.doorsOf(entry);
        const check = exp.canPlaceEntry(entry, this.hoverCell.x, this.hoverCell.y);
        this.view.drawGhost(
          ctx,
          exp,
          this.hoverCell,
          { doorsMask: mask },
          check.ok,
          check.ok ? null : check.reason,
        );
      }
    }

    // Actors, painter-sorted so the room reads front to back.
    const actors = [...exp.enemies, ...exp.party.filter((a) => a.alive)];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.side === 'party') drawAdventurer(ctx, actor, this.time);
      else drawEnemy(ctx, actor, this.time);
    }
    drawProjectiles(ctx, exp.projectiles);
    drawParticles(ctx, exp.particles);
    for (const adv of exp.party) if (adv.alive && this.camera.zoom > 0.8) drawNameplate(ctx, adv);
    drawFloaters(ctx, exp.floaters);

    // Rally markers
    for (const adv of exp.party) {
      if (!adv.alive || adv.order !== 'rally' || !adv.orderPoint) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(240, 220, 150, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(adv.orderPoint.x, adv.orderPoint.y, 9 + Math.sin(this.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    this.view.drawLighting(ctx, exp, this.camera, L.w, L.h);
    vignette(ctx, L.w, L.h, 0.5);

    // HUD
    this.hudRects.top = drawTopBar(ctx, exp, L, { hover: this.hover, showHelp: this.showHelp });
    this.hudRects.party = drawParty(ctx, exp, L, { hover: this.hover });
    drawLog(ctx, exp, L);
    this.hudRects.hand = drawHandBar(ctx, exp, L, {
      hover: this.hover,
      heldCard: this.heldCard,
      selection: this.selection,
    });
    drawBiomeFlash(ctx, exp, L);

    if (exp.extracting && !exp.outcome) {
      const waiting = exp.living.filter((a) => a.roomKey !== '0,0').length;
      text(
        ctx,
        waiting ? `EXTRACTING — waiting on ${waiting}` : 'EXTRACTING',
        L.w / 2,
        L.map.y + 26,
        { align: 'center', size: 15, color: '#ffd76b', font: FONT_DISPLAY },
      );
    }
    if (exp.paused && !exp.outcome) {
      text(ctx, 'PAUSED', L.w / 2, L.map.y + 52, { align: 'center', size: 22, color: COLORS.dim, font: FONT_DISPLAY });
    }

    if (this.hoverInfo) this.drawTooltip(ctx, this.hoverInfo);
    if (this.toastTimer > 0 && this.toast) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastTimer * 2);
      const w = 420;
      panel(ctx, (L.w - w) / 2, L.hand.y - 40, w, 28, { fill: 'rgba(14,12,20,0.92)' });
      text(ctx, this.toast, L.w / 2, L.hand.y - 21, { align: 'center', size: 12, color: COLORS.ink });
      ctx.restore();
    }
    if (this.showHelp) drawHelp(ctx, L);
    if (exp.outcome) this.drawEndCurtain(ctx, L);
  }

  drawTooltip(ctx, info) {
    if (info.kind === 'adventurer') {
      drawAdventurerTip(ctx, info.adv, Math.min(info.x, this.layout.w - 244), info.y);
      return;
    }
    const w = 240;
    const lines = wrap(ctx, info.body || '', w - 20, { size: 10 });
    const h = 26 + lines.length * 13;
    const x = Math.max(6, Math.min(info.x, this.layout.w - w - 6));
    const y = Math.max(6, info.y);
    panel(ctx, x, y, w, h, { fill: 'rgba(12, 11, 18, 0.96)', edge: COLORS.edgeBright });
    text(ctx, info.title, x + 10, y + 16, { size: 11, color: COLORS.gold, font: FONT_DISPLAY });
    lines.forEach((line, i) => text(ctx, line, x + 10, y + 30 + i * 13, { size: 10, color: COLORS.dim }));
  }

  drawEndCurtain(ctx, L) {
    const a = Math.min(0.78, this.endTimer * 0.5);
    ctx.save();
    ctx.fillStyle = `rgba(6, 5, 10, ${a})`;
    ctx.fillRect(0, 0, L.w, L.h);
    const titles = {
      extracted: 'OUT, AND ALIVE',
      victory: 'THE VAULTWYRM IS DEAD',
      wiped: 'NOBODY CAME BACK',
      timeout: 'THE DUNGEON CLOSES',
    };
    ctx.globalAlpha = Math.min(1, this.endTimer);
    text(ctx, titles[this.exp.outcome] || 'DONE', L.w / 2, L.h / 2, {
      align: 'center',
      size: 34,
      color: this.exp.outcome === 'wiped' ? '#d5646a' : COLORS.gold,
      font: FONT_DISPLAY,
    });
    ctx.restore();
  }
}

