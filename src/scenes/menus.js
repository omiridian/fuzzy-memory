// Every menu screen: the pause menu, party, summary, bag, the Weave Ledger
// (dex), the quest log, shops, storage, and the small overlays used by
// scripts (choices, party pickers, learning a move).

import { ListMenu, panel, text, bar, hpColor, COLORS, typeBadge, statusBadge, paragraph, roundRect, TextBox } from '../render/ui.js';
import { getItem, POCKETS } from '../systems/inventory.js';
import { getSpecies, DEX, DEX_ORDER, DEX_COUNT, evolutionLine } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { getAbility } from '../data/abilities.js';
import { natureSummary } from '../data/natures.js';
import { STAT_KEYS, STAT_NAMES } from '../data/natures.js';
import { displayName, levelProgress, expToNextLevel, friendshipLabel, isFainted } from '../systems/monster.js';
import { drawCreature } from '../render/sprites.js';
import { formatMoney, formatPlayTime, dexNumber, titleize } from '../core/util.js';
import { defensiveChart, typeName, typeColor } from '../data/types.js';

class BaseScene {
  constructor(app) {
    this.app = app;
    this.game = app.game;
    this.time = 0;
  }
  update(dt) {
    this.time += dt;
  }
  close() {
    this.app.pop();
  }
}

// ── Pause menu ─────────────────────────────────────────────────────────────
export class PauseMenu extends BaseScene {
  constructor(app) {
    super(app);
    const entries = [
      { label: 'Party', value: 'party' },
      { label: 'Bag', value: 'bag' },
      { label: 'Weave Ledger', value: 'dex' },
      { label: 'Quests', value: 'quests' },
      { label: 'Save', value: 'save' },
      { label: 'Close', value: 'close' },
    ];
    this.menu = new ListMenu(entries, {
      visible: entries.length,
      onSelect: (item) => this.select(item.value),
      onCancel: () => this.close(),
    });
  }

  select(value) {
    switch (value) {
      case 'party':
        this.app.push(new PartyScene(this.app));
        break;
      case 'bag':
        this.app.push(new BagScene(this.app));
        break;
      case 'dex':
        this.app.push(new DexScene(this.app));
        break;
      case 'quests':
        this.app.push(new QuestScene(this.app));
        break;
      case 'save':
        this.app.saveGame();
        break;
      default:
        this.close();
        break;
    }
  }

  handleInput(key, down) {
    if (!down) return;
    if (key === 'menu') return this.close();
    this.menu.handle(key);
  }

  render(ctx) {
    const w = 210;
    const x = this.app.width - w - 16;
    panel(ctx, x, 16, w, 190);
    this.menu.render(ctx, x + 14, 30, w - 28, { lineHeight: 26, size: 15 });

    panel(ctx, 16, this.app.height - 92, 300, 76);
    text(ctx, this.game.playerName, 32, this.app.height - 78, { size: 15, color: COLORS.accent });
    text(ctx, `${formatMoney(this.game.bag.money)} shards`, 32, this.app.height - 58, { size: 13 });
    text(ctx, `Ledger: ${this.game.caughtCount()}/${DEX_COUNT}`, 32, this.app.height - 40, { size: 13 });
    text(ctx, formatPlayTime(this.game.playTime), 296, this.app.height - 78, {
      size: 13,
      align: 'right',
      color: COLORS.textDim,
    });
    text(ctx, `${this.game.timeLabel()} · ${this.game.clockString()}`, 296, this.app.height - 58, {
      size: 12,
      align: 'right',
      color: COLORS.textDim,
    });
  }
}

// ── Party ──────────────────────────────────────────────────────────────────
export class PartyScene extends BaseScene {
  constructor(app, opts = {}) {
    super(app);
    this.opts = opts;
    this.party = opts.party || this.game.party.mons;
    this.index = 0;
    this.swapFrom = null;
    this.message = opts.title || null;
  }

  handleInput(key, down) {
    if (!down) return;
    if (key === 'up') this.index = (this.index - 1 + this.party.length) % this.party.length;
    if (key === 'down') this.index = (this.index + 1) % this.party.length;
    if (key === 'left') this.index = Math.max(0, this.index - 1);
    if (key === 'right') this.index = Math.min(this.party.length - 1, this.index + 1);
    if (key === 'confirm') {
      const mon = this.party[this.index];
      if (!mon) return;
      if (this.opts.onSelect) {
        this.close();
        this.opts.onSelect(mon, this.index);
        return;
      }
      if (this.swapFrom !== null) {
        this.game.party.swap(this.swapFrom, this.index);
        this.swapFrom = null;
        return;
      }
      this.app.push(new SummaryScene(this.app, this.party, this.index));
    }
    if (key === 'menu') {
      if (this.opts.onSelect) return;
      this.swapFrom = this.swapFrom === null ? this.index : null;
    }
    if (key === 'cancel') {
      if (this.swapFrom !== null) {
        this.swapFrom = null;
        return;
      }
      this.close();
      if (this.opts.onCancel) this.opts.onCancel();
    }
  }

  render(ctx) {
    ctx.fillStyle = '#171b26';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    text(ctx, this.message || 'Your team', 20, 18, { size: 16, color: COLORS.accent });
    text(ctx, this.swapFrom !== null ? 'Choose a partner to swap with' : '[M] reorder   [Z] look closer   [X] back', this.app.width - 20, 20, {
      size: 12,
      align: 'right',
      color: COLORS.textDim,
    });

    this.party.forEach((mon, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 20 + col * (this.app.width / 2 - 26);
      const y = 46 + row * 96;
      const wBox = this.app.width / 2 - 34;
      const selected = i === this.index;
      panel(ctx, x, y, wBox, 86, {
        fill: selected ? '#2b3346' : COLORS.panel,
        border: this.swapFrom === i ? COLORS.accent : COLORS.border,
      });
      drawCreature(ctx, mon.species, x + 44, y + 74, 62, { shiny: mon.shiny });
      const species = getSpecies(mon.species);
      text(ctx, displayName(mon), x + 84, y + 12, { size: 14 });
      text(ctx, `Lv${mon.level}`, x + wBox - 14, y + 12, { size: 13, align: 'right', color: COLORS.textDim });
      const ratio = mon.hp / mon.stats.hp;
      bar(ctx, x + 84, y + 34, wBox - 100, 8, ratio, hpColor(ratio));
      text(ctx, `${mon.hp}/${mon.stats.hp}`, x + 84, y + 46, { size: 11, color: COLORS.textDim });
      let bx = x + 150;
      if (mon.status) bx += statusBadge(ctx, mon.status, bx, y + 44) + 4;
      let tx = x + 84;
      for (const t of species.types) tx += typeBadge(ctx, t, tx, y + 62, { width: 46, height: 14, size: 9 }) + 4;
      if (mon.held) {
        text(ctx, getItem(mon.held).name, x + wBox - 14, y + 64, {
          size: 10,
          align: 'right',
          color: COLORS.textDim,
        });
      }
    });
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
export class SummaryScene extends BaseScene {
  constructor(app, party, index) {
    super(app);
    this.party = party;
    this.index = index;
    this.page = 0;
    this.pages = ['Stats', 'Moves', 'Dex'];
  }

  get mon() {
    return this.party[this.index];
  }

  handleInput(key, down) {
    if (!down) return;
    if (key === 'cancel') return this.close();
    if (key === 'left') this.page = (this.page - 1 + this.pages.length) % this.pages.length;
    if (key === 'right') this.page = (this.page + 1) % this.pages.length;
    if (key === 'up') this.index = (this.index - 1 + this.party.length) % this.party.length;
    if (key === 'down') this.index = (this.index + 1) % this.party.length;
  }

  render(ctx) {
    const mon = this.mon;
    const species = getSpecies(mon.species);
    ctx.fillStyle = '#151a24';
    ctx.fillRect(0, 0, this.app.width, this.app.height);

    // Left card.
    panel(ctx, 16, 16, 240, this.app.height - 32);
    drawCreature(ctx, mon.species, 136, 200, 150, { shiny: mon.shiny });
    text(ctx, displayName(mon), 32, 28, { size: 18, color: COLORS.accent });
    text(ctx, `${dexNumber(species.num)} ${species.name}`, 32, 52, { size: 12, color: COLORS.textDim });
    let tx = 32;
    for (const t of species.types) tx += typeBadge(ctx, t, tx, 72) + 6;
    text(ctx, `Lv ${mon.level}`, 32, 214, { size: 15 });
    text(ctx, mon.shiny ? 'Shining' : '', 224, 214, { size: 12, align: 'right', color: COLORS.accent });
    const prog = levelProgress(mon);
    bar(ctx, 32, 238, 192, 6, prog, COLORS.exp);
    text(ctx, `${expToNextLevel(mon)} EXP to next level`, 32, 250, { size: 11, color: COLORS.textDim });
    const ratio = mon.hp / mon.stats.hp;
    bar(ctx, 32, 274, 192, 8, ratio, hpColor(ratio));
    text(ctx, `HP ${mon.hp}/${mon.stats.hp}`, 32, 288, { size: 12, color: COLORS.textDim });

    // Right page.
    const x = 272;
    const w = this.app.width - x - 16;
    panel(ctx, x, 16, w, this.app.height - 32);
    this.pages.forEach((name, i) => {
      const px = x + 16 + i * 82;
      const active = i === this.page;
      if (active) {
        ctx.fillStyle = 'rgba(240,176,64,0.2)';
        roundRect(ctx, px - 8, 26, 76, 22, 4, true, false);
      }
      text(ctx, name, px, 30, { size: 13, color: active ? COLORS.accent : COLORS.textDim });
    });
    text(ctx, '← →', x + w - 16, 30, { size: 12, align: 'right', color: COLORS.textDim });

    if (this.page === 0) this.renderStats(ctx, x + 16, 64, w - 32, mon, species);
    if (this.page === 1) this.renderMoves(ctx, x + 16, 64, w - 32, mon);
    if (this.page === 2) this.renderDex(ctx, x + 16, 64, w - 32, mon, species);
  }

  renderStats(ctx, x, y, w, mon, species) {
    text(ctx, `Nature: ${mon.nature} (${natureSummary(mon.nature)})`, x, y, { size: 13 });
    const ability = getAbility(mon.ability);
    text(ctx, `Ability: ${ability ? ability.name : '—'}`, x, y + 20, { size: 13 });
    if (ability) paragraph(ctx, ability.desc, x, y + 38, w, { size: 11, color: COLORS.textDim });

    let sy = y + 76;
    for (const key of STAT_KEYS) {
      const value = mon.stats[key];
      const base = species.stats[key];
      text(ctx, STAT_NAMES[key], x, sy, { size: 12, color: COLORS.textDim });
      text(ctx, String(value), x + 90, sy, { size: 12 });
      bar(ctx, x + 130, sy + 2, w - 200, 8, Math.min(1, base / 160), '#5fb0e0', { border: false });
      text(ctx, `IV ${mon.ivs[key]}  EV ${mon.evs[key]}`, x + w, sy, {
        size: 10,
        align: 'right',
        color: COLORS.textDim,
      });
      sy += 22;
    }
    sy += 6;
    text(ctx, `It is ${friendshipLabel(mon)}.`, x, sy, { size: 12, color: COLORS.textDim });
    text(ctx, `Held: ${mon.held ? getItem(mon.held).name : 'nothing'}`, x, sy + 18, { size: 12, color: COLORS.textDim });
    text(ctx, `Met at ${titleize(mon.caughtAt || 'unknown')} · Lv${mon.caughtLevel}`, x, sy + 36, {
      size: 11,
      color: COLORS.textDim,
    });
  }

  renderMoves(ctx, x, y, w, mon) {
    mon.moves.forEach((slot, i) => {
      const move = getMove(slot.id);
      const my = y + i * 62;
      ctx.fillStyle = typeColor(move.type);
      ctx.fillRect(x, my, 4, 52);
      text(ctx, move.name, x + 14, my, { size: 14 });
      text(ctx, `${slot.pp}/${slot.maxPp} PP`, x + w, my, { size: 12, align: 'right', color: COLORS.textDim });
      text(
        ctx,
        `${typeName(move.type)} · ${move.category} · pow ${move.power || '—'} · acc ${move.accuracy || '—'}`,
        x + 14,
        my + 18,
        { size: 11, color: COLORS.textDim }
      );
      paragraph(ctx, move.desc, x + 14, my + 34, w - 20, { size: 11, color: COLORS.textDim });
    });
  }

  renderDex(ctx, x, y, w, mon, species) {
    const used = paragraph(ctx, species.dex, x, y, w, { size: 12 });
    let sy = y + used + 12;
    text(ctx, `Height ${species.height}m · Weight ${species.weight}kg`, x, sy, { size: 11, color: COLORS.textDim });
    sy += 22;
    text(ctx, 'Evolution line', x, sy, { size: 13, color: COLORS.accent });
    sy += 20;
    for (const entry of evolutionLine(species.id)) {
      const marker = entry.species.id === species.id ? '▶ ' : '  ';
      const prefix = '  '.repeat(entry.depth);
      const evoNote =
        entry.species.prevo && DEX[entry.species.prevo]
          ? DEX[entry.species.prevo].evolutions.find((e) => e.to === entry.species.id)
          : null;
      text(ctx, `${prefix}${marker}${entry.species.name}`, x, sy, {
        size: 12,
        color: entry.species.id === species.id ? COLORS.text : COLORS.textDim,
      });
      if (evoNote) {
        text(ctx, evoNote.note, x + w, sy, { size: 11, align: 'right', color: COLORS.textDim });
      }
      sy += 18;
    }
    sy += 8;
    text(ctx, 'Weaknesses', x, sy, { size: 13, color: COLORS.accent });
    sy += 20;
    const chart = defensiveChart(species.types);
    const weak = Object.keys(chart).filter((t) => chart[t] > 1);
    const resist = Object.keys(chart).filter((t) => chart[t] < 1 && chart[t] > 0);
    const immune = Object.keys(chart).filter((t) => chart[t] === 0);
    let bx = x;
    for (const t of weak) {
      if (bx > x + w - 60) {
        bx = x;
        sy += 20;
      }
      bx += typeBadge(ctx, t, bx, sy, { width: 50, height: 15, size: 9 }) + 4;
    }
    sy += 26;
    text(ctx, `Resists: ${resist.map(typeName).join(', ') || 'nothing'}`, x, sy, { size: 11, color: COLORS.textDim });
    if (immune.length) {
      text(ctx, `Immune: ${immune.map(typeName).join(', ')}`, x, sy + 16, { size: 11, color: COLORS.textDim });
    }
  }
}

// ── Bag ────────────────────────────────────────────────────────────────────
export class BagScene extends BaseScene {
  constructor(app, opts = {}) {
    super(app);
    this.opts = opts;
    this.pocketIndex = 0;
    this.pockets = POCKETS;
    this.textBox = new TextBox({ width: 56 });
    this.buildMenu();
  }

  get pocket() {
    return this.pockets[this.pocketIndex];
  }

  buildMenu() {
    const ids = this.game.bag.pocket(this.pocket.id);
    const items = ids.map((id) => ({
      label: getItem(id).name,
      right: getItem(id).key ? '' : `x${this.game.bag.count(id)}`,
      value: id,
    }));
    this.menu = new ListMenu(items.length ? items : [{ label: '(empty)', value: null }], {
      visible: 8,
      onSelect: (item) => item.value && this.use(item.value),
      onCancel: () => this.close(),
    });
  }

  use(itemId) {
    const item = getItem(itemId);
    const result = this.game.useItem(itemId, null);
    if (result.needsTarget) {
      this.app.pushPartyPicker({
        title: `Use the ${item.name} on which creature?`,
        onSelect: (mon, index) => {
          const applied = this.game.useItem(itemId, index);
          this.afterUse(applied);
        },
      });
      return;
    }
    this.afterUse(result);
  }

  afterUse(result) {
    if (result.evolution) {
      this.app.beginEvolution(result.evolution.mon, result.evolution.evo);
      this.buildMenu();
      return;
    }
    if (result.learn) {
      this.app.pushMoveLearner(result.learn.mon, result.learn.moveId, {});
      this.buildMenu();
      return;
    }
    if (result.warp) {
      this.app.warpTo(result.warp);
      this.close();
      return;
    }
    if (result.fish) {
      this.close();
      if (this.app.overworld) this.app.overworld.startFishing(result.fish);
      return;
    }
    if (result.message) this.textBox.say(result.message);
    this.buildMenu();
  }

  handleInput(key, down) {
    if (!down) return;
    if (this.textBox.isBusy) {
      if (key === 'confirm' || key === 'cancel') this.textBox.advance();
      return;
    }
    if (key === 'left' || key === 'right') {
      const dir = key === 'left' ? -1 : 1;
      this.pocketIndex = (this.pocketIndex + dir + this.pockets.length) % this.pockets.length;
      this.buildMenu();
      return;
    }
    this.menu.handle(key);
  }

  update(dt) {
    super.update(dt);
    this.textBox.update(dt);
  }

  render(ctx) {
    ctx.fillStyle = '#171b26';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    text(ctx, 'Bag', 20, 18, { size: 16, color: COLORS.accent });
    text(ctx, `${formatMoney(this.game.bag.money)} shards`, this.app.width - 20, 20, {
      size: 13,
      align: 'right',
      color: COLORS.accent,
    });

    this.pockets.forEach((p, i) => {
      const x = 20 + i * 74;
      const active = i === this.pocketIndex;
      if (active) {
        ctx.fillStyle = 'rgba(240,176,64,0.2)';
        roundRect(ctx, x - 6, 42, 70, 22, 4, true, false);
      }
      text(ctx, p.name, x, 46, { size: 11, color: active ? COLORS.accent : COLORS.textDim });
    });

    panel(ctx, 16, 74, this.app.width / 2 + 30, this.app.height - 160);
    this.menu.render(ctx, 32, 90, this.app.width / 2, { lineHeight: 24, size: 13 });

    const current = this.menu.current;
    const detailX = this.app.width / 2 + 56;
    panel(ctx, detailX, 74, this.app.width - detailX - 16, this.app.height - 160);
    if (current && current.value) {
      const item = getItem(current.value);
      text(ctx, item.name, detailX + 16, 90, { size: 15, color: COLORS.accent });
      paragraph(ctx, item.desc, detailX + 16, 116, this.app.width - detailX - 48, { size: 12 });
      const lines = [];
      if (item.price) lines.push(`Buys for ${formatMoney(item.price)}`);
      if (item.sell) lines.push(`Sells for ${formatMoney(item.sell)}`);
      if (item.hold) lines.push('Can be held.');
      text(ctx, lines.join('  ·  '), detailX + 16, this.app.height - 190, { size: 11, color: COLORS.textDim });
    }

    text(ctx, '[←→] pockets   [Z] use   [X] back', 20, this.app.height - 74, { size: 12, color: COLORS.textDim });
    if (this.textBox.isBusy) {
      this.textBox.render(ctx, 16, this.app.height - 62, this.app.width - 32, 50, this.time);
    }
  }
}

// ── Weave Ledger (dex) ─────────────────────────────────────────────────────
export class DexScene extends BaseScene {
  constructor(app) {
    super(app);
    this.entries = DEX_ORDER.map((id) => DEX[id]);
    const items = this.entries.map((species) => {
      const caught = this.game.dexCaught[species.id];
      const seen = this.game.dexSeen[species.id];
      return {
        label: `${dexNumber(species.num)} ${caught || seen ? species.name : '???'}`,
        right: caught ? '●' : seen ? '○' : '',
        value: species.id,
        color: caught ? COLORS.text : seen ? COLORS.textDim : '#4a4f5c',
      };
    });
    this.menu = new ListMenu(items, {
      visible: 14,
      onCancel: () => this.close(),
    });
  }

  handleInput(key, down) {
    if (!down) return;
    if (key === 'left') this.menu.move(-10);
    else if (key === 'right') this.menu.move(10);
    else this.menu.handle(key);
  }

  render(ctx) {
    ctx.fillStyle = '#171b26';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    text(ctx, 'Weave Ledger', 20, 18, { size: 16, color: COLORS.accent });
    text(
      ctx,
      `seen ${this.game.seenCount()}   caught ${this.game.caughtCount()} / ${DEX_COUNT}`,
      this.app.width - 20,
      20,
      { size: 12, align: 'right', color: COLORS.textDim }
    );

    panel(ctx, 16, 44, 280, this.app.height - 76);
    this.menu.render(ctx, 32, 58, 250, { lineHeight: 22, size: 13 });

    const species = DEX[this.menu.current.value];
    const x = 312;
    const w = this.app.width - x - 16;
    panel(ctx, x, 44, w, this.app.height - 76);
    const known = this.game.dexSeen[species.id] || this.game.dexCaught[species.id];
    if (!known) {
      text(ctx, 'No record yet.', x + 20, 70, { size: 14, color: COLORS.textDim });
      return;
    }
    drawCreature(ctx, species.id, x + w / 2, 210, 140);
    text(ctx, `${dexNumber(species.num)} ${species.name}`, x + 20, 62, { size: 17, color: COLORS.accent });
    let tx = x + 20;
    for (const t of species.types) tx += typeBadge(ctx, t, tx, 88) + 6;
    if (species.legendary) text(ctx, 'LEGENDARY', x + w - 20, 88, { size: 11, align: 'right', color: COLORS.accent });

    let y = 226;
    y += paragraph(ctx, species.dex, x + 20, y, w - 40, { size: 12 }) + 8;
    text(ctx, `Height ${species.height}m · Weight ${species.weight}kg · ${titleize(species.rarity)}`, x + 20, y, {
      size: 11,
      color: COLORS.textDim,
    });
    y += 20;
    if (this.game.dexCaught[species.id]) {
      const stats = STAT_KEYS.map((k) => `${k.toUpperCase()} ${species.stats[k]}`).join('  ');
      text(ctx, stats, x + 20, y, { size: 11, color: COLORS.textDim });
      y += 18;
      text(ctx, `Abilities: ${species.abilities.map((a) => getAbility(a).name).join(', ')}`, x + 20, y, {
        size: 11,
        color: COLORS.textDim,
      });
      y += 18;
      if (species.evolutions.length) {
        for (const evo of species.evolutions) {
          text(ctx, `→ ${DEX[evo.to].name}: ${evo.note}`, x + 20, y, { size: 11, color: COLORS.textDim });
          y += 16;
        }
      }
      const habitats = species.habitat.length ? species.habitat.map(titleize).join(', ') : 'Unknown';
      text(ctx, `Found in: ${habitats}`, x + 20, y, { size: 11, color: COLORS.textDim });
    }
  }
}

// ── Quest log ──────────────────────────────────────────────────────────────
export class QuestScene extends BaseScene {
  constructor(app) {
    super(app);
    this.rebuild();
  }

  rebuild() {
    const active = this.game.quests.activeList();
    const done = this.game.quests.completedList().filter((q) => !q.hidden);
    const items = [
      ...active.map((q) => ({ label: q.name, right: q.type === 'main' ? `Ch.${q.chapter}` : 'side', value: q.id })),
      ...done.map((q) => ({ label: q.name, right: 'done', value: q.id, color: COLORS.textDim })),
    ];
    this.menu = new ListMenu(items.length ? items : [{ label: 'No quests yet.', value: null }], {
      visible: 12,
      onCancel: () => this.close(),
    });
  }

  handleInput(key, down) {
    if (!down) return;
    this.menu.handle(key);
  }

  render(ctx) {
    ctx.fillStyle = '#171b26';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    text(ctx, 'Quests', 20, 18, { size: 16, color: COLORS.accent });

    panel(ctx, 16, 44, 260, this.app.height - 76);
    this.menu.render(ctx, 32, 58, 230, { lineHeight: 22, size: 13 });

    const current = this.menu.current;
    const x = 292;
    const w = this.app.width - x - 16;
    panel(ctx, x, 44, w, this.app.height - 76);
    if (!current || !current.value) return;
    const q = this.game.quests
      .activeList()
      .concat(this.game.quests.completedList())
      .find((entry) => entry.id === current.value);
    if (!q) return;
    text(ctx, q.name, x + 20, 62, { size: 16, color: COLORS.accent });
    text(ctx, q.giver ? `— ${q.giver}` : '', x + 20, 84, { size: 12, color: COLORS.textDim });
    let y = 106;
    y += paragraph(ctx, q.summary, x + 20, y, w - 40, { size: 12 }) + 12;
    for (const step of this.game.quests.progress(q.id)) {
      text(ctx, step.done ? '✓' : '·', x + 20, y, { size: 13, color: step.done ? COLORS.good : COLORS.textDim });
      y += paragraph(ctx, step.text, x + 40, y, w - 60, {
        size: 12,
        color: step.done ? COLORS.textDim : COLORS.text,
      });
      y += 6;
    }
    if (q.reward && (q.reward.money || (q.reward.items || []).length)) {
      y += 10;
      const parts = [];
      if (q.reward.money) parts.push(`${formatMoney(q.reward.money)} shards`);
      for (const item of q.reward.items || []) {
        if (item.qty > 0) parts.push(`${item.qty}x ${getItem(item.item).name}`);
      }
      text(ctx, `Reward: ${parts.join(', ')}`, x + 20, y, { size: 11, color: COLORS.accent });
    }
  }
}

// ── Shop ───────────────────────────────────────────────────────────────────
export class ShopScene extends BaseScene {
  constructor(app, stock) {
    super(app);
    this.stock = stock;
    this.mode = 'buy';
    this.textBox = new TextBox({ width: 56 });
    this.quantity = 1;
    this.buildMenu();
  }

  buildMenu() {
    const ids =
      this.mode === 'buy'
        ? this.stock
        : Object.keys(this.game.bag.items).filter((id) => !getItem(id).key && getItem(id).sell > 0);
    const items = ids.map((id) => {
      const item = getItem(id);
      return {
        label: item.name,
        right: this.mode === 'buy' ? formatMoney(item.price) : `${formatMoney(item.sell)} (x${this.game.bag.count(id)})`,
        value: id,
      };
    });
    this.menu = new ListMenu(items.length ? items : [{ label: '(nothing)', value: null }], {
      visible: 8,
      onSelect: (item) => item.value && this.transact(item.value),
      onCancel: () => this.close(),
    });
    this.quantity = 1;
  }

  transact(itemId) {
    const item = getItem(itemId);
    if (this.mode === 'buy') {
      const bought = this.game.bag.buy(itemId, this.quantity);
      if (!bought) {
        this.textBox.say('You cannot afford that.');
        return;
      }
      this.textBox.say(`${bought}x ${item.name}. Pleasure doing business.`);
    } else {
      const value = this.game.bag.sell(itemId, this.quantity);
      if (!value) {
        this.textBox.say('There is nothing to sell there.');
        return;
      }
      this.textBox.say(`Sold for ${formatMoney(value)} shards.`);
    }
    this.buildMenu();
  }

  handleInput(key, down) {
    if (!down) return;
    if (this.textBox.isBusy) {
      if (key === 'confirm' || key === 'cancel') this.textBox.advance();
      return;
    }
    if (key === 'menu') {
      this.mode = this.mode === 'buy' ? 'sell' : 'buy';
      this.buildMenu();
      return;
    }
    if (key === 'left') {
      this.quantity = Math.max(1, this.quantity - 1);
      return;
    }
    if (key === 'right') {
      this.quantity = Math.min(99, this.quantity + 1);
      return;
    }
    this.menu.handle(key);
  }

  update(dt) {
    super.update(dt);
    this.textBox.update(dt);
  }

  render(ctx) {
    ctx.fillStyle = '#171b26';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    text(ctx, this.mode === 'buy' ? 'Shop — buying' : 'Shop — selling', 20, 18, { size: 16, color: COLORS.accent });
    text(ctx, `${formatMoney(this.game.bag.money)} shards`, this.app.width - 20, 20, {
      size: 13,
      align: 'right',
      color: COLORS.accent,
    });

    panel(ctx, 16, 44, this.app.width / 2 + 20, this.app.height - 140);
    this.menu.render(ctx, 32, 58, this.app.width / 2 - 10, { lineHeight: 24, size: 13 });

    const detailX = this.app.width / 2 + 48;
    panel(ctx, detailX, 44, this.app.width - detailX - 16, this.app.height - 140);
    const current = this.menu.current;
    if (current && current.value) {
      const item = getItem(current.value);
      text(ctx, item.name, detailX + 16, 60, { size: 15, color: COLORS.accent });
      paragraph(ctx, item.desc, detailX + 16, 86, this.app.width - detailX - 48, { size: 12 });
      text(ctx, `Quantity: ${this.quantity}   [←→]`, detailX + 16, this.app.height - 180, {
        size: 12,
        color: COLORS.textDim,
      });
      const total = (this.mode === 'buy' ? item.price : item.sell) * this.quantity;
      text(ctx, `Total: ${formatMoney(total)}`, detailX + 16, this.app.height - 162, { size: 13 });
    }

    text(ctx, '[M] switch buy/sell   [Z] confirm   [X] leave', 20, this.app.height - 84, {
      size: 12,
      color: COLORS.textDim,
    });
    if (this.textBox.isBusy) {
      this.textBox.render(ctx, 16, this.app.height - 68, this.app.width - 32, 56, this.time);
    }
  }
}

// ── Storage ────────────────────────────────────────────────────────────────
export class StorageScene extends BaseScene {
  constructor(app) {
    super(app);
    this.boxIndex = 0;
    this.cursor = 0;
    this.side = 'box'; // 'box' | 'party'
    this.message = 'Move creatures between the terminal and your team.';
  }

  get box() {
    return this.game.storage.boxes[this.boxIndex];
  }

  handleInput(key, down) {
    if (!down) return;
    if (key === 'cancel') return this.close();
    if (key === 'menu') {
      this.side = this.side === 'box' ? 'party' : 'box';
      this.cursor = 0;
      return;
    }
    const list = this.side === 'box' ? this.box.mons : this.game.party.mons;
    const columns = this.side === 'box' ? 6 : 1;
    if (key === 'left') this.cursor = Math.max(0, this.cursor - 1);
    if (key === 'right') this.cursor = Math.min(Math.max(0, list.length - 1), this.cursor + 1);
    if (key === 'up') this.cursor = Math.max(0, this.cursor - columns);
    if (key === 'down') this.cursor = Math.min(Math.max(0, list.length - 1), this.cursor + columns);
    if (key === 'confirm') this.transfer();
  }

  transfer() {
    if (this.side === 'box') {
      const mon = this.box.mons[this.cursor];
      if (!mon) return;
      if (this.game.party.isFull()) {
        this.message = 'Your team is full.';
        return;
      }
      this.box.mons.splice(this.cursor, 1);
      this.game.party.add(mon);
      this.message = `${displayName(mon)} joined your team.`;
    } else {
      const mon = this.game.party.get(this.cursor);
      if (!mon) return;
      if (this.game.party.length <= 1) {
        this.message = 'You cannot travel with nothing.';
        return;
      }
      this.game.party.remove(this.cursor);
      this.game.storage.deposit(mon);
      this.message = `${displayName(mon)} rests in the terminal.`;
    }
    this.cursor = Math.max(0, this.cursor - 1);
  }

  render(ctx) {
    ctx.fillStyle = '#141824';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    text(ctx, `Storage — ${this.box.name}`, 20, 16, { size: 16, color: COLORS.accent });
    text(ctx, '[M] switch side   [Z] move   [X] leave', this.app.width - 20, 18, {
      size: 12,
      align: 'right',
      color: COLORS.textDim,
    });

    panel(ctx, 16, 42, this.app.width - 220, this.app.height - 100);
    for (let i = 0; i < 30; i++) {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = 32 + col * 74;
      const y = 58 + row * 68;
      const mon = this.box.mons[i];
      const selected = this.side === 'box' && this.cursor === i;
      ctx.fillStyle = selected ? 'rgba(240,176,64,0.22)' : 'rgba(255,255,255,0.04)';
      roundRect(ctx, x, y, 64, 60, 4, true, false);
      if (mon) {
        drawCreature(ctx, mon.species, x + 32, y + 52, 44, { shiny: mon.shiny });
        text(ctx, `L${mon.level}`, x + 4, y + 4, { size: 10, color: COLORS.textDim });
      }
    }

    const px = this.app.width - 196;
    panel(ctx, px, 42, 180, this.app.height - 100);
    text(ctx, 'Team', px + 14, 54, { size: 13, color: COLORS.accent });
    this.game.party.mons.forEach((mon, i) => {
      const y = 76 + i * 44;
      const selected = this.side === 'party' && this.cursor === i;
      if (selected) {
        ctx.fillStyle = 'rgba(240,176,64,0.22)';
        roundRect(ctx, px + 8, y - 4, 164, 40, 4, true, false);
      }
      drawCreature(ctx, mon.species, px + 30, y + 32, 34, { shiny: mon.shiny });
      text(ctx, displayName(mon), px + 52, y + 4, { size: 12 });
      text(ctx, `Lv${mon.level}`, px + 52, y + 20, { size: 11, color: COLORS.textDim });
    });

    text(ctx, this.message, 20, this.app.height - 48, { size: 12, color: COLORS.textDim });
  }
}

// ── Overlays ───────────────────────────────────────────────────────────────
export class ChoiceScene extends BaseScene {
  constructor(app, opts) {
    super(app);
    this.opts = opts;
    this.menu = new ListMenu(opts.options, {
      visible: Math.min(6, opts.options.length),
      onSelect: (item) => {
        this.close();
        opts.onSelect(item);
      },
      onCancel: () => {
        this.close();
        if (opts.onCancel) opts.onCancel();
      },
    });
  }

  handleInput(key, down) {
    if (!down) return;
    this.menu.handle(key);
  }

  renderBelow() {
    return true;
  }

  render(ctx) {
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    const w = 380;
    const h = 80 + this.menu.items.length * 26;
    const x = (this.app.width - w) / 2;
    const y = (this.app.height - h) / 2;
    panel(ctx, x, y, w, h);
    text(ctx, this.opts.title, x + 20, y + 18, { size: 14, color: COLORS.accent });
    this.menu.render(ctx, x + 24, y + 48, w - 48, { lineHeight: 26, size: 14 });
    const current = this.menu.current;
    if (current && current.detail) {
      paragraph(ctx, current.detail, x + 20, y + h - 30, w - 40, { size: 11, color: COLORS.textDim });
    }
  }
}

export class MoveLearnerScene extends BaseScene {
  constructor(app, mon, moveId, opts = {}) {
    super(app);
    this.mon = mon;
    this.moveId = moveId;
    this.opts = opts;
    const move = getMove(moveId);
    this.menu = new ListMenu(
      [
        ...mon.moves.map((slot, i) => ({ label: `Forget ${getMove(slot.id).name}`, value: i })),
        { label: `Do not learn ${move.name}`, value: -1 },
      ],
      {
        visible: 5,
        onSelect: (item) => this.pick(item.value),
        onCancel: () => this.pick(-1),
      }
    );
  }

  pick(index) {
    const move = getMove(this.moveId);
    this.close();
    if (index < 0) {
      if (this.opts.onDone) this.opts.onDone(false);
      return;
    }
    this.mon.moves[index] = { id: this.moveId, pp: move.pp, maxPp: move.pp };
    if (this.opts.onDone) this.opts.onDone(true);
  }

  handleInput(key, down) {
    if (!down) return;
    this.menu.handle(key);
  }

  renderBelow() {
    return true;
  }

  render(ctx) {
    ctx.fillStyle = 'rgba(10,12,18,0.7)';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    const move = getMove(this.moveId);
    const w = 420;
    const h = 220;
    const x = (this.app.width - w) / 2;
    const y = (this.app.height - h) / 2;
    panel(ctx, x, y, w, h);
    text(ctx, `${displayName(this.mon)} wants to learn ${move.name}.`, x + 20, y + 16, { size: 14 });
    text(ctx, 'But it already knows four moves. Forget one?', x + 20, y + 36, { size: 12, color: COLORS.textDim });
    this.menu.render(ctx, x + 24, y + 64, w - 48, { lineHeight: 24, size: 13 });
    if (this.opts.cost) {
      text(ctx, `Cost: ${formatMoney(this.opts.cost)} shards`, x + 20, y + h - 26, { size: 11, color: COLORS.accent });
    }
  }
}

export class EvolutionScene extends BaseScene {
  constructor(app, mon, evo, onDone) {
    super(app);
    this.mon = mon;
    this.evo = evo;
    this.onDone = onDone;
    this.fromSpecies = mon.species;
    this.phase = 0;
    this.timer = 0;
    this.textBox = new TextBox({ width: 52 });
    this.textBox.say(`What? ${displayName(mon)} is changing shape!`);
  }

  update(dt) {
    super.update(dt);
    this.textBox.update(dt);
    if (this.textBox.isBusy) return;
    this.timer += dt;
    if (this.phase === 0 && this.timer > 2.2) {
      this.phase = 1;
      const result = this.game.applyEvolution(this.mon, this.evo);
      const name = getSpecies(this.evo.to).name;
      this.textBox.say(`${displayName(this.mon)} became ${name}!`);
      if (result && result.newMoves.length) this.newMoves = result.newMoves.slice();
    } else if (this.phase === 1 && !this.textBox.isBusy) {
      this.phase = 2;
      if (this.newMoves && this.newMoves.length) {
        const moveId = this.newMoves.shift();
        if (this.mon.moves.length < 4) {
          const move = getMove(moveId);
          this.mon.moves.push({ id: moveId, pp: move.pp, maxPp: move.pp });
          this.textBox.say(`${displayName(this.mon)} learned ${move.name}!`);
          this.phase = 1;
          return;
        }
        this.app.pushMoveLearner(this.mon, moveId, {});
        this.phase = 1;
        return;
      }
      this.close();
      if (this.onDone) this.onDone();
    }
  }

  handleInput(key, down) {
    if (!down) return;
    if (key === 'confirm' || key === 'cancel') this.textBox.advance();
  }

  render(ctx) {
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.5;
    const cx = this.app.width / 2;
    const cy = this.app.height / 2 + 30;
    ctx.save();
    ctx.globalAlpha = this.phase === 0 ? 1 - pulse * 0.7 : 0;
    drawCreature(ctx, this.fromSpecies, cx, cy, 170, { shiny: this.mon.shiny });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = this.phase === 0 ? pulse * 0.7 : 1;
    drawCreature(ctx, this.phase === 0 ? this.evo.to : this.mon.species, cx, cy, 170, { shiny: this.mon.shiny });
    ctx.restore();

    const grd = ctx.createRadialGradient(cx, cy - 60, 10, cx, cy - 60, 200);
    grd.addColorStop(0, `rgba(240,230,160,${0.25 + pulse * 0.25})`);
    grd.addColorStop(1, 'rgba(240,230,160,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.app.width, this.app.height);

    this.textBox.render(ctx, 16, this.app.height - 96, this.app.width - 32, 80, this.time);
  }
}

export { BaseScene };
