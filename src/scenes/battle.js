// The battle screen. It consumes the engine's event queue, animating HP bars
// and waiting for input on text, then hands control back to the player.

import { Battle } from '../battle/engine.js';
import { getMove } from '../data/moves.js';
import { getItem } from '../data/items.js';
import { getSpecies } from '../data/species.js';
import { displayName, isFainted } from '../systems/monster.js';
import { drawCreature } from '../render/sprites.js';
import {
  panel, text, bar, hpColor, COLORS, TextBox, ListMenu, typeBadge, statusBadge, roundRect,
} from '../render/ui.js';
import { typeColor } from '../data/types.js';
import { formatMoney } from '../core/util.js';

const MENU_MAIN = 'main';
const MENU_MOVES = 'moves';
const MENU_SWITCH = 'switch';
const MENU_BAG = 'bag';

export class BattleScene {
  constructor(app, battle, opts = {}) {
    this.app = app;
    this.game = app.game;
    this.battle = battle;
    this.opts = opts;
    this.textBox = new TextBox({ width: 56, speed: 60 });
    this.events = [];
    this.state = 'events';
    this.menu = MENU_MAIN;
    this.time = 0;
    this.shakeTimer = 0;
    this.flashTimer = 0;
    this.orbThrow = null;
    this.pendingLearn = null;
    this.displayHp = {};
    this.captured = null;

    this.mainMenu = new ListMenu(
      [
        { label: 'Fight', value: 'fight' },
        { label: 'Bag', value: 'bag' },
        { label: 'Party', value: 'party' },
        { label: battle.isWild ? 'Run' : 'Forfeit', value: 'run' },
      ],
      { columns: 2, visible: 2, onSelect: (item) => this.chooseMain(item.value) }
    );

    this.pushEvents(battle.start());
  }

  // ── Event pump ───────────────────────────────────────────────────────────
  pushEvents(events) {
    this.events.push(...events);
    this.state = 'events';
  }

  syncHp() {
    for (const key of ['player', 'foe']) {
      const mon = this.battle.active(key);
      if (mon && this.displayHp[mon.uid] === undefined) this.displayHp[mon.uid] = mon.hp;
    }
  }

  update(dt) {
    this.time += dt;
    this.textBox.update(dt);
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    this.syncHp();

    // Animate HP bars toward their true values.
    let animating = false;
    for (const key of ['player', 'foe']) {
      const mon = this.battle.active(key);
      if (!mon) continue;
      const shown = this.displayHp[mon.uid];
      if (shown === undefined) continue;
      if (Math.abs(shown - mon.hp) > 0.5) {
        const speed = Math.max(mon.stats.hp * 0.9, 40);
        const delta = Math.sign(mon.hp - shown) * speed * dt;
        this.displayHp[mon.uid] =
          Math.abs(mon.hp - shown) < Math.abs(delta) ? mon.hp : shown + delta;
        animating = true;
      } else {
        this.displayHp[mon.uid] = mon.hp;
      }
    }

    if (this.state === 'events' && !this.textBox.isBusy && !animating) {
      this.processNext();
    }
  }

  processNext() {
    if (!this.events.length) {
      this.afterEvents();
      return;
    }
    const event = this.events.shift();
    switch (event.t) {
      case 'text':
        this.textBox.say(event.text);
        break;
      case 'damage':
        this.shakeTimer = 0.22;
        if (event.side === 'player') this.flashTimer = 0.12;
        break;
      case 'move':
        this.flashTimer = 0.1;
        break;
      case 'enter':
        this.displayHp[event.uid] = this.findMon(event.uid) ? this.findMon(event.uid).hp : 0;
        break;
      case 'throw':
        this.orbThrow = { item: event.item, shakes: event.shakes, caught: event.caught, t: 0 };
        break;
      case 'faint':
        this.shakeTimer = 0.3;
        break;
      case 'requestSwitch':
        this.state = 'awaitSwitch';
        this.openSwitchMenu(true);
        return;
      case 'levelup':
        this.queueLearnCheck(event);
        break;
      case 'end':
        this.captured = event.caught;
        break;
      default:
        break;
    }
    // Keep pumping until something needs to wait.
    if (!this.textBox.isBusy && this.state === 'events') this.processNext();
  }

  findMon(uid) {
    return (
      this.battle.sides.player.party.find((m) => m.uid === uid) ||
      this.battle.sides.foe.party.find((m) => m.uid === uid) ||
      null
    );
  }

  queueLearnCheck(event) {
    const mon = this.findMon(event.uid);
    if (!mon || !event.moves || !event.moves.length) return;
    for (const moveId of event.moves) {
      if (mon.moves.some((m) => m.id === moveId)) continue;
      if (mon.moves.length < 4) {
        mon.moves.push({ id: moveId, pp: getMove(moveId).pp, maxPp: getMove(moveId).pp });
        this.textBox.say(`${displayName(mon)} learned ${getMove(moveId).name}!`);
      } else {
        this.pendingLearn = this.pendingLearn || [];
        this.pendingLearn.push({ mon, moveId });
      }
    }
  }

  afterEvents() {
    if (this.pendingLearn && this.pendingLearn.length) {
      const next = this.pendingLearn.shift();
      this.app.pushMoveLearner(next.mon, next.moveId, {});
      return;
    }
    if (this.battle.state === 'ended') {
      this.finish();
      return;
    }
    if (this.battle.awaitingSwitch === 'player') {
      this.state = 'awaitSwitch';
      this.openSwitchMenu(true);
      return;
    }
    this.state = 'menu';
    this.menu = MENU_MAIN;
  }

  // ── Menus ────────────────────────────────────────────────────────────────
  chooseMain(value) {
    switch (value) {
      case 'fight':
        this.openMoveMenu();
        break;
      case 'bag':
        this.openBagMenu();
        break;
      case 'party':
        this.openSwitchMenu(false);
        break;
      case 'run':
        if (!this.battle.isWild) {
          this.textBox.say('There is no forfeiting a trainer battle.');
          return;
        }
        this.battle.setPlayerAction({ type: 'run' });
        this.runTurn();
        break;
      default:
        break;
    }
  }

  openMoveMenu() {
    const mon = this.battle.playerMon;
    const options = this.battle.availableMoves(mon).map(({ slot, index }) => {
      const move = getMove(slot.id);
      return {
        label: move.name,
        right: `${slot.pp}/${slot.maxPp}`,
        value: index,
        move,
        color: slot.pp === 0 ? COLORS.bad : COLORS.text,
      };
    });
    if (!options.length) {
      this.battle.setPlayerAction({ type: 'struggle' });
      this.runTurn();
      return;
    }
    this.moveMenu = new ListMenu(options, {
      columns: 2,
      visible: 2,
      onSelect: (item) => {
        this.battle.setPlayerAction({ type: 'move', index: item.value });
        this.runTurn();
      },
      onCancel: () => {
        this.menu = MENU_MAIN;
      },
    });
    this.menu = MENU_MOVES;
  }

  openSwitchMenu(forced) {
    const party = this.battle.sides.player.party;
    const options = party.map((mon, index) => ({
      label: `${displayName(mon)} Lv${mon.level}`,
      right: isFainted(mon) ? 'fainted' : `${mon.hp}/${mon.stats.hp}`,
      value: index,
      color: isFainted(mon) ? COLORS.bad : COLORS.text,
      mon,
    }));
    this.switchMenu = new ListMenu(options, {
      visible: 6,
      onSelect: (item) => {
        if (isFainted(item.mon)) {
          this.textBox.say(`${displayName(item.mon)} cannot fight.`);
          return;
        }
        if (item.value === this.battle.sides.player.activeIndex) {
          this.textBox.say(`${displayName(item.mon)} is already out.`);
          return;
        }
        if (forced) {
          this.battle.switchIn('player', item.value);
          this.battle.awaitingSwitch = null;
          this.pushEvents(this.battle.drainEvents());
          this.menu = MENU_MAIN;
        } else {
          this.battle.setPlayerAction({ type: 'switch', index: item.value });
          this.runTurn();
        }
      },
      onCancel: () => {
        if (!forced) this.menu = MENU_MAIN;
      },
    });
    this.menu = MENU_SWITCH;
    this.forcedSwitch = forced;
  }

  openBagMenu() {
    const bag = this.game.bag;
    const usable = Object.keys(bag.items).filter((id) => {
      const item = getItem(id);
      return item && (item.where === 'battle' || item.where === 'both');
    });
    if (!usable.length) {
      this.textBox.say('Nothing in the bag would help right now.');
      return;
    }
    const options = usable
      .sort((a, b) => getItem(a).sort - getItem(b).sort)
      .map((id) => ({
        label: getItem(id).name,
        right: `x${bag.count(id)}`,
        value: id,
        item: getItem(id),
      }));
    this.bagMenu = new ListMenu(options, {
      visible: 5,
      onSelect: (item) => {
        const def = item.item;
        if (def.target === 'party' && def.effect && (def.effect.heal !== undefined || def.effect.revive || def.effect.cure || def.effect.pp !== undefined)) {
          this.app.pushPartyPicker({
            title: `Use the ${def.name} on which creature?`,
            party: this.battle.sides.player.party,
            onSelect: (mon) => {
              const index = this.battle.sides.player.party.indexOf(mon);
              this.battle.setPlayerAction({ type: 'item', itemId: item.value, targetIndex: index });
              this.runTurn();
            },
          });
          return;
        }
        this.battle.setPlayerAction({ type: 'item', itemId: item.value });
        this.runTurn();
      },
      onCancel: () => {
        this.menu = MENU_MAIN;
      },
    });
    this.menu = MENU_BAG;
  }

  runTurn() {
    this.state = 'events';
    this.pushEvents(this.battle.runTurn());
  }

  // ── Input ────────────────────────────────────────────────────────────────
  handleInput(key, down) {
    if (!down) return;
    if (this.textBox.isBusy) {
      if (key === 'confirm' || key === 'cancel') this.textBox.advance();
      return;
    }
    if (this.state !== 'menu' && this.state !== 'awaitSwitch') return;

    switch (this.menu) {
      case MENU_MAIN:
        this.mainMenu.handle(key);
        break;
      case MENU_MOVES:
        this.moveMenu.handle(key);
        break;
      case MENU_SWITCH:
        this.switchMenu.handle(key);
        break;
      case MENU_BAG:
        this.bagMenu.handle(key);
        break;
      default:
        break;
    }
  }

  // ── Ending ───────────────────────────────────────────────────────────────
  finish() {
    if (this.finished) return;
    this.finished = true;
    const battle = this.battle;
    const game = this.game;
    game.bag.earn(battle.moneyEarned);

    const done = () => {
      this.app.endBattle({
        outcome: battle.outcome,
        trainerNpc: this.opts.trainerNpc,
        caught: battle.caught,
        onVictory: this.opts.onVictory,
      });
    };

    if (battle.caught) {
      const mon = battle.caught;
      const placement = game.receiveMon(mon, { fromCatch: true });
      const species = getSpecies(mon.species);
      const lines = [`${species.name} was added to your Ledger.`];
      if (placement.where === 'storage') lines.push(`${displayName(mon)} was sent to storage.`);
      if (this.opts.legendary) game.setFlag(`caught_${this.opts.legendary}`);
      this.textBox.say(lines, { onFinish: done });
      return;
    }
    if (battle.outcome === 'victory' && battle.moneyEarned) {
      this.textBox.say(`You picked up ${formatMoney(battle.moneyEarned)} shards.`, { onFinish: done });
      return;
    }
    done();
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  render(ctx) {
    const w = this.app.width;
    const h = this.app.height;
    const battle = this.battle;

    // Backdrop.
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    const env = this.opts.environment || 'grass';
    const sky = env === 'cave' ? ['#2a2028', '#141018'] : env === 'water' ? ['#2f5f8f', '#17324f'] : ['#7fb4d8', '#cfe4c8'];
    grd.addColorStop(0, sky[0]);
    grd.addColorStop(1, sky[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (this.shakeTimer > 0) {
      ctx.translate((Math.random() - 0.5) * 6 * this.shakeTimer * 4, (Math.random() - 0.5) * 4 * this.shakeTimer * 4);
    }

    // Ground platforms.
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(w * 0.72, h * 0.42, w * 0.18, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.28, h * 0.68, w * 0.22, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    const foe = battle.foeMon;
    const mine = battle.playerMon;

    if (foe) {
      drawCreature(ctx, foe.species, w * 0.72, h * 0.44, 108, {
        shiny: foe.shiny,
        alpha: isFainted(foe) ? 0.25 : 1,
      });
    }
    if (mine) {
      drawCreature(ctx, mine.species, w * 0.28, h * 0.7, 132, {
        back: true,
        shiny: mine.shiny,
        alpha: isFainted(mine) ? 0.25 : 1,
      });
    }
    ctx.restore();

    if (foe) this.renderStatusPlate(ctx, foe, 24, 24, false);
    if (mine) this.renderStatusPlate(ctx, mine, w - 264, h - 208, true);

    if (this.flashTimer > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashTimer * 1.6})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Weather label.
    if (battle.weather) {
      panel(ctx, w / 2 - 60, 8, 120, 24, { radius: 4 });
      text(ctx, battle.weather.toUpperCase(), w / 2, 14, { size: 12, align: 'center', color: COLORS.accent });
    }

    // Bottom bar.
    const boxY = h - 128;
    if (this.textBox.isBusy || this.state === 'events') {
      this.textBox.render(ctx, 12, boxY, w - 24, 116, this.time);
    } else {
      this.renderMenu(ctx, boxY, w, h);
    }
  }

  renderStatusPlate(ctx, mon, x, y, isPlayer) {
    const w = 240;
    const h = isPlayer ? 66 : 56;
    panel(ctx, x, y, w, h, { radius: 6 });
    const species = getSpecies(mon.species);
    text(ctx, displayName(mon), x + 12, y + 10, { size: 14 });
    text(ctx, `Lv${mon.level}`, x + w - 12, y + 10, { size: 13, align: 'right', color: COLORS.textDim });

    const shown = this.displayHp[mon.uid] !== undefined ? this.displayHp[mon.uid] : mon.hp;
    const ratio = Math.max(0, shown / mon.stats.hp);
    bar(ctx, x + 12, y + 30, w - 24, 8, ratio, hpColor(ratio));
    if (isPlayer) {
      text(ctx, `${Math.ceil(shown)}/${mon.stats.hp}`, x + w - 12, y + 42, {
        size: 12,
        align: 'right',
        color: COLORS.textDim,
      });
    }
    let bx = x + 12;
    if (mon.status) bx += statusBadge(ctx, mon.status, bx, y + 42) + 6;
    for (const type of species.types) {
      if (!isPlayer || bx < x + 120) {
        bx += typeBadge(ctx, type, bx, y + 42, { width: 46, height: 15, size: 9 }) + 4;
      }
    }
  }

  renderMenu(ctx, y, w, h) {
    const boxH = 116;
    panel(ctx, 12, y, w - 24, boxH);

    if (this.menu === MENU_MAIN) {
      const mon = this.battle.playerMon;
      text(ctx, `What will ${displayName(mon)} do?`, 32, y + 16, { size: 15 });
      const options = this.mainMenu.items;
      options.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = w / 2 + col * 130;
        const by = y + 40 + row * 30;
        const selected = this.mainMenu.index === i;
        if (selected) {
          ctx.fillStyle = 'rgba(240,176,64,0.2)';
          roundRect(ctx, bx - 8, by - 6, 120, 26, 4, true, false);
        }
        text(ctx, item.label, bx, by, { size: 15, color: selected ? COLORS.accent : COLORS.text });
      });
      return;
    }

    if (this.menu === MENU_MOVES) {
      const items = this.moveMenu.items;
      items.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = 32 + col * 260;
        const by = y + 16 + row * 34;
        const selected = this.moveMenu.index === i;
        if (selected) {
          ctx.fillStyle = 'rgba(240,176,64,0.18)';
          roundRect(ctx, bx - 8, by - 5, 244, 30, 4, true, false);
        }
        text(ctx, item.label, bx, by + 4, { size: 14, color: selected ? COLORS.accent : COLORS.text });
        text(ctx, item.right, bx + 200, by + 4, { size: 12, align: 'right', color: COLORS.textDim });
        ctx.fillStyle = typeColor(item.move.type);
        ctx.fillRect(bx - 4, by, 3, 20);
      });
      const current = this.moveMenu.current;
      if (current) {
        const move = current.move;
        text(
          ctx,
          `${move.category} · power ${move.power || '—'} · acc ${move.accuracy || '—'}`,
          32,
          y + boxH - 26,
          { size: 12, color: COLORS.textDim }
        );
        text(ctx, move.desc, w - 36, y + boxH - 26, { size: 12, color: COLORS.textDim, align: 'right' });
      }
      return;
    }

    if (this.menu === MENU_SWITCH) {
      text(ctx, this.forcedSwitch ? 'Send out which creature?' : 'Switch to which creature?', 32, y + 10, { size: 14 });
      this.switchMenu.visible = 4;
      this.switchMenu.render(ctx, 36, y + 32, w - 80, { lineHeight: 20, size: 13 });
      return;
    }

    if (this.menu === MENU_BAG) {
      text(ctx, 'Use which item?', 32, y + 10, { size: 14 });
      this.bagMenu.visible = 4;
      this.bagMenu.render(ctx, 36, y + 32, w - 80, { lineHeight: 20, size: 13 });
    }
  }
}

export { Battle };
