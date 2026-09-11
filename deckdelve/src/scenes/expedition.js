// The play scene. Everything the player actually does happens here: holding a
// card, choosing where it goes, and then watching four people find out.
//
// The same code serves a mouse and a thumb. The scene asks the layout where
// things are and the gesture layer what kind of press it was; nothing below
// knows whether it is running on a desk or on a phone.

import { Expedition } from '../systems/expedition.js';
import { legalCells, worldToGrid } from '../systems/grid.js';
import { Camera } from '../render/view.js';
import { DungeonView } from '../render/dungeonview.js';
import { drawAdventurer, drawEnemy, drawFloaters, drawNameplate, drawParticles, drawProjectiles } from '../render/actors.js';
import {
  ORDERS, drawAdventurerTip, drawBiomeFlash, drawHandBar, drawHelp, drawLog, drawMenuSheet,
  drawOrders, drawParty, drawTopBar, layoutFor,
} from '../render/hud.js';
import { COLORS, FONT_DISPLAY, hit, panel, text, vignette, wrap } from '../render/ui.js';
import { clamp, dist } from '../core/util.js';

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
    this.layout = layoutFor(app.width, app.height, app.compact);
    // A small screen wants more of the dungeon in it, not a closer look.
    this.homeZoom = this.layout.compact ? 0.82 : 1.25;
    this.camera = new Camera(this.layout.map, this.homeZoom);
    this.view = new DungeonView();
    this.selection = [];
    this.heldCard = null;
    this.hoverCell = null;
    this.hoverInfo = null;
    this.hoverHold = 0;
    this.legal = [];
    this.legalKey = '';
    this.hover = null;
    this.showHelp = false;
    this.menuOpen = false;
    this.rallyArmed = false;
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

  get touch() {
    return this.app.touching;
  }

  get selectedOrAll() {
    return this.selection.length ? this.selection.filter((a) => a.alive) : this.exp.living;
  }

  syncLayout() {
    if (this.layout.w !== this.app.width || this.layout.h !== this.app.height || this.layout.compact !== this.app.compact) {
      this.layout = layoutFor(this.app.width, this.app.height, this.app.compact);
      this.camera.setViewport(this.layout.map);
      this.legalKey = '';
    }
  }

  say(message) {
    this.toast = message;
    this.toastTimer = 2.8;
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
    let bestD = this.touch ? 26 : 18;
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
    let bestD = this.touch ? 28 : 20;
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

  /** Tells the gesture layer whether a drag from here should move the camera. */
  onDragStart(x, y) {
    return hit(this.layout.map, x, y) ? 'pan' : null;
  }

  onDragPan(dx, dy) {
    this.camera.pan(-dx, -dy);
  }

  onZoom(factor, x, y) {
    this.camera.scaleBy(factor, { x, y });
  }

  onPointerMove(x, y) {
    this.updateHover(x, y);
  }

  /**
   * `persist` is what separates a mouse from a thumb. A mouse hovers, so every
   * control can explain itself for free. A tap is already an action, so a tap
   * must not leave a panel sitting over the buttons underneath it — only a
   * deliberate press-and-hold, or a tap on a portrait, opens one.
   */
  updateHover(x, y, persist = false) {
    this.hover = null;
    this.hoverInfo = null;
    const L = this.layout;
    const R = this.hudRects;

    if (R.top) {
      for (const name of Object.keys(R.top)) {
        if (hit(R.top[name], x, y)) this.hover = name;
      }
    }
    if (R.sheet) {
      for (const name of Object.keys(R.sheet)) {
        if (hit(R.sheet[name], x, y)) this.hover = `sheet_${name}`;
      }
    }
    if (R.party) {
      R.party.forEach((r, i) => {
        if (hit(r, x, y)) {
          this.hover = `party${i}`;
          this.hoverInfo = {
            kind: 'adventurer',
            adv: r.adv,
            x: L.compact ? r.x - 40 : r.x + r.w + 8,
            y: L.compact ? r.y + r.h + 6 : r.y,
          };
        }
      });
    }
    if (R.orders) {
      R.orders.forEach((r, i) => {
        if (hit(r, x, y)) {
          this.hover = `order${i}`;
          this.hoverInfo = {
            kind: 'text',
            title: r.order.label,
            body: r.order.blurb,
            x: r.x - 40,
            y: r.y - 62,
          };
        }
      });
    }
    if (R.hand) {
      R.hand.cardRects.forEach((r, i) => {
        if (hit(r, x, y)) {
          this.hover = `card${i}`;
          this.hoverInfo = {
            kind: 'text',
            title: r.entry.card.name,
            body: r.entry.card.blurb,
            x: r.x - 50,
            y: r.y - 82,
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
          x: x + 12,
          y: y + 14,
        };
      }
    } else {
      this.hoverCell = null;
    }
    if (this.touch) {
      if (persist && this.hoverInfo) this.hoverHold = 3.2;
      else this.hoverInfo = null;
    }
  }

  onPointerDown(x, y, button) {
    const L = this.layout;
    const R = this.hudRects;

    if (this.showHelp) {
      this.showHelp = false;
      return;
    }
    if (this.exp.outcome) return;

    // The overflow sheet, when it is open, swallows everything else.
    if (this.menuOpen) {
      if (R.sheet) {
        if (hit(R.sheet.speed, x, y)) {
          this.exp.speed = this.exp.speed >= 3 ? 1 : this.exp.speed + 1;
          return;
        }
        if (hit(R.sheet.pause, x, y)) {
          this.exp.paused = !this.exp.paused;
          this.menuOpen = false;
          return;
        }
        if (hit(R.sheet.follow, x, y)) {
          this.camera.recentre(this.exp.living.length ? this.exp.partyCentroid() : null, this.homeZoom);
          this.menuOpen = false;
          return;
        }
        if (hit(R.sheet.help, x, y)) {
          this.showHelp = true;
          this.menuOpen = false;
          return;
        }
      }
      if (!R.top || !hit(R.top.menu, x, y)) {
        this.menuOpen = false;
        return;
      }
    }

    if (R.top) {
      if (R.top.extract && hit(R.top.extract, x, y)) {
        if (this.exp.extracting) this.exp.cancelExtraction();
        else this.exp.beginExtraction();
        return;
      }
      if (R.top.menu && hit(R.top.menu, x, y)) {
        this.menuOpen = !this.menuOpen;
        return;
      }
      if (R.top.pause && hit(R.top.pause, x, y)) {
        this.exp.paused = !this.exp.paused;
        return;
      }
      if (R.top.speed && hit(R.top.speed, x, y)) {
        this.exp.speed = this.exp.speed >= 3 ? 1 : this.exp.speed + 1;
        return;
      }
      if (R.top.help && hit(R.top.help, x, y)) {
        this.showHelp = true;
        return;
      }
    }

    if (R.party) {
      for (const r of R.party) {
        if (hit(r, x, y)) {
          this.selectAdventurer(r.adv, this.app.keys.ShiftLeft || this.app.keys.ShiftRight);
          // Tapping a portrait is also how you read somebody on a phone.
          if (this.touch) this.updateHover(x, y, true);
          return;
        }
      }
    }

    if (R.orders) {
      for (const r of R.orders) {
        if (hit(r, x, y)) {
          this.applyOrder(r.order.id);
          return;
        }
      }
    }

    if (R.hand) {
      for (const r of R.hand.cardRects) {
        if (hit(r, x, y)) {
          this.heldCard = this.heldCard === r.entry.uid ? null : r.entry.uid;
          this.rallyArmed = false;
          this.refreshLegal();
          return;
        }
      }
      if (R.hand.rotate && hit(R.hand.rotate, x, y)) {
        this.rotateHeld();
        return;
      }
      if (R.hand.mulligan && hit(R.hand.mulligan, x, y)) {
        this.mulliganHeld();
        return;
      }
    }

    if (!hit(L.map, x, y)) return;
    const world = this.camera.toWorld(x, y);

    // A press-and-hold over a monster is how you read it on a phone; over the
    // floor it is an order.
    if (button === 2 && this.touch && this.enemyAt(world)) {
      this.updateHover(x, y, true);
      return;
    }

    // A press-and-hold, a right-click, or an armed Rally all mean the same
    // thing: point at something and tell them about it.
    if (button === 2 || this.rallyArmed) {
      this.rallyArmed = false;
      const foe = this.enemyAt(world);
      if (foe) {
        this.exp.focusTarget(this.selectedOrAll, foe);
        this.say(`Focus fire: ${foe.name}`);
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
    if (adv || !this.touch) {
      this.selectAdventurer(adv, this.app.keys.ShiftLeft || this.app.keys.ShiftRight);
      if (adv && this.touch) this.hoverHold = 3.2;
    }
  }

  onPointerUp() {}

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
      else if (this.menuOpen) this.menuOpen = false;
      else if (this.rallyArmed) this.rallyArmed = false;
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
    if ((code === 'KeyR' || code === 'KeyQ') && this.heldCard) {
      this.rotateHeld(code === 'KeyQ' ? 3 : 1);
      return;
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
      this.camera.recentre(this.exp.living.length ? this.exp.partyCentroid() : null, this.homeZoom);
      this.say('Camera follows the party.');
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
      this.rallyArmed = !this.rallyArmed;
      this.heldCard = this.rallyArmed ? null : this.heldCard;
      this.say(this.rallyArmed ? 'Now point at where you want them.' : 'Rally cancelled.');
      return;
    }
    this.rallyArmed = false;
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
    this.syncLayout();
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
    if (this.hoverHold > 0) {
      this.hoverHold -= dt;
      if (this.hoverHold <= 0) this.hoverInfo = null;
    }
    if (this.exp.outcome) {
      this.endTimer += dt;
      if (this.endTimer > 2.6) this.finishToResults();
    }
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
    this.syncLayout();
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
        this.view.drawGhost(ctx, exp, this.hoverCell, { doorsMask: mask }, check.ok, check.ok ? null : check.reason);
      }
    }

    const actors = [...exp.enemies, ...exp.party.filter((a) => a.alive)];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.side === 'party') drawAdventurer(ctx, actor, this.time);
      else drawEnemy(ctx, actor, this.time, this.camera.zoom);
    }
    drawProjectiles(ctx, exp.projectiles);
    drawParticles(ctx, exp.particles);
    for (const adv of exp.party) if (adv.selected) drawNameplate(ctx, adv, this.camera.zoom);
    drawFloaters(ctx, exp.floaters);

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

    const state = {
      hover: this.hover,
      showHelp: this.showHelp,
      heldCard: this.heldCard,
      selection: this.selection,
      rallyArmed: this.rallyArmed,
      follow: this.camera.follow,
    };
    this.hudRects.top = drawTopBar(ctx, exp, L, state);
    this.hudRects.party = drawParty(ctx, exp, L, state);
    drawLog(ctx, exp, L);
    // The hand bar paints the whole bottom band on a wide screen, and the
    // orders sit inside it — so the band goes down first.
    this.hudRects.hand = drawHandBar(ctx, exp, L, state);
    this.hudRects.orders = drawOrders(ctx, exp, L, state);
    drawBiomeFlash(ctx, exp, L);
    this.hudRects.sheet = this.menuOpen ? drawMenuSheet(ctx, exp, L, state) : null;

    if (this.rallyArmed && !exp.outcome) {
      this.banner(ctx, L, 'Point at where you want them', '#ffd76b');
    } else if (exp.extracting && !exp.outcome) {
      const waiting = exp.living.filter((a) => a.roomKey !== '0,0').length;
      this.banner(ctx, L, waiting ? `EXTRACTING — waiting on ${waiting}` : 'EXTRACTING', '#ffd76b');
    }
    if (exp.paused && !exp.outcome) {
      text(ctx, 'PAUSED', L.w / 2, L.map.y + L.map.h / 2, {
        align: 'center',
        size: 26,
        color: COLORS.dim,
        font: FONT_DISPLAY,
      });
    }

    if (this.hoverInfo) this.drawTooltip(ctx, this.hoverInfo);
    if (this.toastTimer > 0 && this.toast) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastTimer * 2);
      const w = Math.min(420, L.w - 24);
      const y = L.compact ? L.map.y + (this.rallyArmed || exp.extracting ? 42 : 8) : L.hand.y - 38;
      panel(ctx, (L.w - w) / 2, y, w, 28, { fill: 'rgba(14,12,20,0.94)' });
      wrap(ctx, this.toast, w - 20, { size: 12 }).slice(0, 1).forEach((line) =>
        text(ctx, line, L.w / 2, y + 19, { align: 'center', size: 12, color: COLORS.ink }),
      );
      ctx.restore();
    }
    if (this.showHelp) drawHelp(ctx, L, this.touch);
    if (exp.outcome) this.drawEndCurtain(ctx, L);
  }

  banner(ctx, L, message, color) {
    const w = Math.min(340, L.w - 24);
    const x = (L.w - w) / 2;
    const y = L.map.y + 8;
    panel(ctx, x, y, w, 28, { fill: 'rgba(14,12,20,0.88)', edge: color });
    text(ctx, message, L.w / 2, y + 19, { align: 'center', size: 13, color, font: FONT_DISPLAY });
  }

  drawTooltip(ctx, info) {
    const L = this.layout;
    if (info.kind === 'adventurer') {
      drawAdventurerTip(ctx, info.adv, info.x, info.y, L);
      return;
    }
    const w = Math.min(240, L.w - 16);
    const lines = wrap(ctx, info.body || '', w - 20, { size: 10 });
    const h = 26 + lines.length * 13;
    const x = clamp(info.x, 8, L.w - w - 8);
    const y = clamp(info.y, 8, L.h - h - 8);
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
    const size = L.compact ? 24 : 34;
    wrap(ctx, titles[this.exp.outcome] || 'DONE', L.w - 40, { size, font: FONT_DISPLAY }).forEach((line, i) =>
      text(ctx, line, L.w / 2, L.h / 2 + i * (size + 6), {
        align: 'center',
        size,
        color: this.exp.outcome === 'wiped' ? '#d5646a' : COLORS.gold,
        font: FONT_DISPLAY,
      }),
    );
    ctx.restore();
  }
}
