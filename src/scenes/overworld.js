// The overworld scene: walking around, talking to people, picking things up,
// running into wild creatures, and opening everything else.

import { MapView } from '../render/mapview.js';
import { tileAt } from '../world/tiles.js';
import { prepareMap, canMoveTo, warpAt, rollEncounter, encounterChance, environmentOf } from '../world/world.js';
import { getItem } from '../data/items.js';
import { TextBox, panel, text, COLORS, bar, hpColor } from '../render/ui.js';
import { abilityFlag } from '../data/abilities.js';
import { displayName } from '../systems/monster.js';
import { runScript } from './scripts.js';
import { formatMoney } from '../core/util.js';

const MOVE_TIME = 0.16;
const RUN_TIME = 0.09;

export class OverworldScene {
  constructor(app) {
    this.app = app;
    this.game = app.game;
    this.view = new MapView(app.width, app.height);
    this.textBox = new TextBox({ width: 58 });
    this.moving = null;
    this.frame = 0;
    this.stepTimer = 0;
    this.pendingScript = null;
    this.banner = null;
    this.bannerTimer = 0;
    this.transition = null;
    this.enterMap(this.game.mapId, this.game.x, this.game.y, { silent: true });
  }

  get map() {
    return prepareMap(this.game.mapId);
  }

  // ── Map entry ────────────────────────────────────────────────────────────
  enterMap(mapId, x, y, opts = {}) {
    const map = prepareMap(mapId);
    if (!map) return;
    this.game.mapId = mapId;
    this.game.x = x;
    this.game.y = y;
    this.moving = null;
    this.warpCooldown = null;
    this.view.centerOn(x, y, map);
    this.groundItems = (map.items || []).filter((entry) => !this.game.getFlag(entry.flag));
    if (!opts.silent) {
      this.showBanner(map.name);
      this.game.setFlag(`entered_${mapId}`);
    }
    if (map.indoor || map.cave) this.game.setFlag(`entered_${mapId}`);
    // Waystations double as respawn points.
    if (map.npcs && map.npcs.some((n) => n.healer)) {
      this.game.setWaystation(mapId, x, y);
    }
  }

  showBanner(str) {
    this.banner = str;
    this.bannerTimer = 2.2;
  }

  // ── Input ────────────────────────────────────────────────────────────────
  handleInput(key, down) {
    if (!down) return;
    if (this.textBox.isBusy) {
      if (key === 'confirm' || key === 'cancel') {
        const stillGoing = this.textBox.advance();
        if (!stillGoing && this.pendingScript) {
          const next = this.pendingScript;
          this.pendingScript = null;
          next();
        }
      }
      return;
    }
    if (key === 'menu' || key === 'start') {
      this.app.push(this.app.makeMenuScene());
      return;
    }
    if (key === 'confirm') {
      this.interact();
      return;
    }
  }

  // ── Movement ─────────────────────────────────────────────────────────────
  update(dt) {
    this.game.tick(dt);
    this.textBox.update(dt);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;

    if (this.moving) {
      this.moving.t += dt / this.moving.duration;
      if (this.moving.t >= 1) {
        this.game.x = this.moving.tx;
        this.game.y = this.moving.ty;
        const wasLedge = this.moving.ledge;
        this.moving = null;
        this.frame = (this.frame + 1) % 4;
        this.afterStep(wasLedge);
      }
    } else if (!this.textBox.isBusy && !this.app.busy) {
      this.tryWalk(dt);
    }

    const px = this.game.x + (this.moving ? (this.moving.tx - this.game.x) * this.moving.t : 0);
    const py = this.game.y + (this.moving ? (this.moving.ty - this.game.y) * this.moving.t : 0);
    this.view.centerOn(px, py, this.map);
  }

  tryWalk() {
    const input = this.app.input;
    let dir = null;
    if (input.held.up) dir = 'up';
    else if (input.held.down) dir = 'down';
    else if (input.held.left) dir = 'left';
    else if (input.held.right) dir = 'right';
    if (!dir) return;

    this.game.dir = dir;
    const [dx, dy] = DIRS[dir];
    const tx = this.game.x + dx;
    const ty = this.game.y + dy;
    const map = this.map;
    const blocked = (key) => this.occupied(key);
    const result = canMoveTo(map, tx, ty, dir, blocked);
    if (!result.ok) {
      if (result.water) this.textBox.say('The water is too deep to cross here.');
      return;
    }
    const running = input.held.run && !map.indoor;
    const speedMod = abilityFlag(this.game.party.lead(), 'walkSpeed') || 1;
    this.moving = {
      tx,
      ty,
      t: 0,
      duration: (running ? RUN_TIME : MOVE_TIME) / speedMod,
      ledge: result.ledge,
    };
  }

  occupied(key) {
    const map = this.map;
    for (const npc of map.npcs || []) {
      if (npc.defeatedAndGone) continue;
      if (`${npc.x},${npc.y}` === key) return true;
    }
    return false;
  }

  afterStep() {
    this.game.step();
    const map = this.map;

    // Warps. The tile we were dropped onto is inert until we step off it.
    const here = `${this.game.x},${this.game.y}`;
    if (this.warpCooldown && this.warpCooldown !== here) this.warpCooldown = null;
    const warp = this.warpCooldown === here ? null : warpAt(map, this.game.x, this.game.y);
    if (warp) {
      if (warp.requires && !this.game.bag.has(warp.requires)) {
        this.textBox.say(warp.lockedText || 'The way is closed.');
        return;
      }
      this.doWarp(warp);
      return;
    }

    // Ground items.
    const item = this.groundItems.find((entry) => entry.x === this.game.x && entry.y === this.game.y);
    if (item) {
      this.pickUp(item);
      return;
    }

    // Wild encounters. Nothing lives indoors, whatever the floor is made of.
    const tile = tileAt(map, this.game.x, this.game.y);
    if (tile && tile.encounter && !map.indoor) {
      const lead = this.game.party.lead();
      const modifiers = {
        lure: this.game.lureSteps > 0,
        abilityRate: abilityFlag(lead, 'encounterRate') || 1,
      };
      const chance = encounterChance(tile, modifiers);
      if (this.game.rng.next() < chance) {
        this.startWildBattle(tile);
      }
    }
  }

  doWarp(warp) {
    const target = prepareMap(warp.to);
    if (!target) return;
    const points = target.warpPoints && target.warpPoints[warp.at];
    const landing = points && points.length ? points[0] : { x: target.spawn.x, y: target.spawn.y };
    this.app.fade(() => {
      // Arrive standing on the doorway itself. Walking back onto it is what
      // triggers the return trip, so it stays inert until the player moves.
      this.enterMap(warp.to, landing.x, landing.y);
      this.warpCooldown = `${landing.x},${landing.y}`;
      this.game.dir = this.exitDirection(target, landing);
    });
  }

  /** Faces the player toward whichever side of a doorway is open. */
  exitDirection(map, landing) {
    const options = [
      ['down', 0, 1],
      ['up', 0, -1],
      ['left', -1, 0],
      ['right', 1, 0],
    ];
    for (const [dir, dx, dy] of options) {
      const tile = tileAt(map, landing.x + dx, landing.y + dy);
      if (tile && !tile.solid && !warpAt(map, landing.x + dx, landing.y + dy)) return dir;
    }
    return 'down';
  }

  pickUp(entry) {
    const item = getItem(entry.item);
    this.game.bag.add(entry.item, entry.qty);
    this.game.setFlag(entry.flag);
    this.groundItems = this.groundItems.filter((e) => e !== entry);
    this.textBox.say(`You found ${entry.qty > 1 ? entry.qty + ' ' : 'a '}${item.name}${entry.qty > 1 ? 's' : ''}!`);
  }

  // ── Interaction ──────────────────────────────────────────────────────────
  facingTile() {
    const [dx, dy] = DIRS[this.game.dir];
    return { x: this.game.x + dx, y: this.game.y + dy };
  }

  interact() {
    const map = this.map;
    const { x, y } = this.facingTile();

    const sign = map.signAt && map.signAt[`${x},${y}`];
    if (sign) {
      this.textBox.say(sign.text);
      return;
    }

    const at = (tx, ty) => (map.npcs || []).find((n) => n.x === tx && n.y === ty && !n.defeatedAndGone);
    let npc = at(x, y);
    if (!npc) {
      // Reach across a counter or a table, the way you would in a real shop.
      const tile = tileAt(map, x, y);
      if (tile && tile.solid && (tile.name === 'counter' || tile.name === 'table')) {
        const [dx, dy] = DIRS[this.game.dir];
        npc = at(x + dx, y + dy);
      }
    }
    if (!npc) return;

    // Face the player.
    npc.dir = OPPOSITE[this.game.dir] || npc.dir;

    if (npc.script) {
      runScript(this, npc.script, npc);
      return;
    }
    if (npc.healer) {
      this.healAtWaystation(npc);
      return;
    }
    if (npc.shop) {
      this.textBox.say(['Take your time. Everything is honestly priced.'], {
        onFinish: () => this.app.push(this.app.makeShopScene(npc.shop)),
      });
      return;
    }
    if (npc.storage) {
      this.textBox.say(npc.dialogue || ['The storage terminal blinks awake.'], {
        onFinish: () => this.app.push(this.app.makeStorageScene()),
      });
      return;
    }
    if (npc.trainer && !this.game.getFlag(`beaten_${npc.id}`)) {
      this.startTrainerBattle(npc);
      return;
    }
    if (npc.trainer && this.game.getFlag(`beaten_${npc.id}`)) {
      const after = npc.trainer.dialogue && npc.trainer.dialogue.after;
      this.textBox.say(after || 'Good match. Come back any time.');
      return;
    }
    this.textBox.say(npc.dialogue || ['...']);
    if (npc.onTalkOnce && !this.game.getFlag(npc.onTalkOnce.flag)) {
      const gift = npc.onTalkOnce.give;
      if (gift) {
        this.game.bag.add(gift.item, gift.qty);
        this.textBox.say(`You received ${gift.qty}x ${getItem(gift.item).name}.`);
      }
      this.game.setFlag(npc.onTalkOnce.flag);
    }
  }

  healAtWaystation(npc) {
    this.game.healParty();
    this.game.setWaystation(this.game.mapId, this.game.x, this.game.y);
    this.textBox.say([
      'Let me take a look at your team.',
      'There. Everyone is rested and ready. Safe roads.',
    ]);
  }

  // ── Battles ──────────────────────────────────────────────────────────────
  startWildBattle(tile) {
    const map = this.map;
    const lead = this.game.party.lead();
    if (!lead) return;
    const wild = rollEncounter(map, tile.encounter, this.game.rng, {
      rareBonus: abilityFlag(lead, 'rareBonus') || 1,
    });
    if (!wild) return;
    // Ward Incense keeps weaker things away.
    if (this.game.repelSteps > 0 && wild.level < lead.level) return;
    this.game.recordSeen(wild.species);
    this.app.startBattle({
      foeParty: [wild],
      isWild: true,
      environment: environmentOf(map, tile),
    });
  }

  startTrainerBattle(npc) {
    const trainer = npc.trainer;
    const begin = () => this.app.startBattle({ trainerNpc: npc, trainer, isWild: false });
    const intro = trainer.dialogue && trainer.dialogue.intro;
    if (intro) this.textBox.say([intro], { onFinish: begin });
    else begin();
  }

  /**
   * Casts a rod at the water the player is facing.
   * @param {number} power 1 for the Old Rod, 2 for the Deep Rod
   */
  startFishing(power = 1) {
    const map = this.map;
    const { x, y } = this.facingTile();
    const tile = tileAt(map, x, y);
    if (!tile || !tile.water) {
      this.textBox.say('There is nowhere to cast from here.');
      return false;
    }
    const table = power >= 2 && map.encounters && map.encounters.water_deep ? 'water_deep' : 'water';
    if (!map.encounters || !map.encounters[table]) {
      this.textBox.say('Nothing is biting in this water.');
      return false;
    }
    if (!this.game.rng.percent(power >= 2 ? 70 : 50)) {
      this.textBox.say('Not even a nibble.');
      return true;
    }
    const wild = rollEncounter(map, table, this.game.rng);
    if (!wild) {
      this.textBox.say('Not even a nibble.');
      return true;
    }
    this.game.recordSeen(wild.species);
    this.textBox.say('Something takes the line!', () => {
      this.app.startBattle({ foeParty: [wild], isWild: true, environment: 'water' });
    });
    return true;
  }

  /** Called by the app when a battle finishes. */
  onBattleEnd(result) {
    if (result.trainerNpc) {
      const npc = result.trainerNpc;
      if (result.outcome === 'victory') {
        this.game.setFlag(`beaten_${npc.id}`);
        this.game.battlesWon++;
        if (npc.questFlag) this.game.setFlag(npc.questFlag);
        if (npc.trainer.reward) {
          this.game.bag.add(npc.trainer.reward.item, npc.trainer.reward.qty);
          this.textBox.say(
            `${npc.trainer.name} handed you ${npc.trainer.reward.qty}x ${getItem(npc.trainer.reward.item).name}.`
          );
        }
        if (npc.trainer.dialogue && npc.trainer.dialogue.after) {
          this.textBox.say(npc.trainer.dialogue.after);
        }
        if (npc.onDefeat) runScript(this, npc.onDefeat, npc);
      }
    }
    if (result.outcome === 'defeat') {
      this.whiteOut();
    }
  }

  whiteOut() {
    const spot = this.game.lastWaystation;
    this.game.healParty();
    const lost = Math.floor(this.game.bag.money * 0.15);
    this.game.bag.money -= lost;
    this.app.fade(() => {
      this.enterMap(spot.map, spot.x, spot.y, { silent: true });
      this.textBox.say([
        'Everything went dark...',
        `You came round at the waystation. It cost you ${formatMoney(lost)} shards in favours.`,
      ]);
    });
  }

  say(lines, onFinish) {
    this.textBox.say(lines, { onFinish });
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  render(ctx) {
    const map = this.map;
    const entities = [];
    for (const npc of map.npcs || []) {
      if (npc.defeatedAndGone) continue;
      entities.push({ x: npc.x, y: npc.y, sprite: npc.sprite, dir: npc.dir || 'down', frame: 0 });
    }
    const px = this.moving ? this.game.x + (this.moving.tx - this.game.x) * this.moving.t : this.game.x;
    const py = this.moving ? this.game.y + (this.moving.ty - this.game.y) * this.moving.t : this.game.y;
    entities.push({
      x: px,
      y: py,
      sprite: 'player',
      dir: this.game.dir,
      frame: this.moving ? Math.floor(this.moving.t * 2) + 1 : 0,
    });

    this.view.render(ctx, map, entities, this.app.dt, {
      night: this.game.isNight,
      groundItems: this.groundItems,
    });

    this.renderHud(ctx);

    if (this.bannerTimer > 0) {
      const alpha = Math.min(1, this.bannerTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      panel(ctx, 12, 12, 220, 34);
      text(ctx, this.banner, 24, 22, { size: 15, color: COLORS.accent, weight: 'bold' });
      ctx.restore();
    }

    if (this.textBox.isBusy) {
      this.textBox.render(ctx, 16, this.app.height - 116, this.app.width - 32, 100, this.view.time);
    }
  }

  renderHud(ctx) {
    const lead = this.game.party.lead();
    const w = 190;
    const x = this.app.width - w - 12;
    panel(ctx, x, 12, w, lead ? 60 : 34);
    text(ctx, `${formatMoney(this.game.bag.money)} shards`, x + 12, 20, { size: 12, color: COLORS.accent });
    text(ctx, this.game.clockString(), x + w - 12, 20, { size: 12, color: COLORS.textDim, align: 'right' });
    if (lead) {
      text(ctx, `${displayName(lead)} Lv${lead.level}`, x + 12, 38, { size: 12 });
      bar(ctx, x + 12, 54, w - 24, 6, lead.hp / lead.stats.hp, hpColor(lead.hp / lead.stats.hp));
    }
  }
}

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export { DIRS };
