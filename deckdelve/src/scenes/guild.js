// The Adventurer Guild — everything between expeditions. Who goes down, what is
// in the deck, what the gold buys, and the names on the wall.

import { CARD_BY_ID, CARDS } from '../data/cards.js';
import { CLASSES } from '../data/classes.js';
import { GEAR_BY_ID, GRADE_COLOR, SLOTS } from '../data/equipment.js';
import { TRAITS } from '../data/traits.js';
import {
  CARD_SHOP, CLASS_SHOP, DECK_LIMIT, PARTY_LIMIT, ROSTER_LIMIT, UPGRADES,
  addToDeck, buy, canBuy, copiesInDeck, dismiss, equip, hire, hireCost, ownedCopies,
  partyMembers, removeFromDeck, sellGear, togglePartyMember, unequip,
} from '../systems/guild.js';
import { drawCard } from '../render/cards.js';
import { clamp } from '../core/util.js';
import { COLORS, FONT_DISPLAY, button, hit, panel, roundRect, text, vignette, wrap } from '../render/ui.js';

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'deck', label: 'Dungeon Deck' },
  { id: 'shop', label: 'Requisitions' },
  { id: 'memorial', label: 'The Wall' },
];

export class GuildScene {
  constructor(app, { guild, rng }) {
    this.app = app;
    this.guild = guild;
    this.rng = rng;
    this.tab = 'roster';
    this.hover = null;
    this.rects = {};
    this.scroll = { roster: 0, deck: 0, shop: 0, memorial: 0 };
    this.scrollMax = { roster: 0, deck: 0, shop: 0, memorial: 0 };
    this.selected = guild.roster[0] ? guild.roster[0].id : null;
    this.message = null;
    this.messageTimer = 0;
    this.time = 0;
  }

  get selectedAdv() {
    return this.guild.roster.find((a) => a.id === this.selected) || null;
  }

  say(msg) {
    this.message = msg;
    this.messageTimer = 2.8;
  }

  update(dt) {
    this.time += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
  }

  onWheel(delta) {
    const next = this.scroll[this.tab] + (delta > 0 ? 46 : -46);
    this.scroll[this.tab] = clamp(next, 0, this.scrollMax[this.tab] || 0);
  }

  onPointerMove(x, y) {
    this.hover = null;
    this.walkRects((key, rect) => {
      if (hit(rect, x, y)) this.hover = key;
    });
  }

  onPointerDown(x, y) {
    let handled = null;
    this.walkRects((key, rect) => {
      if (!handled && hit(rect, x, y)) handled = { key, rect };
    });
    if (handled) this.activate(handled.key, handled.rect);
  }

  onKeyDown(code) {
    if (code === 'Escape') this.app.openTitle();
    if (code === 'Enter') this.descend();
    const i = TABS.findIndex((t) => t.id === this.tab);
    if (code === 'BracketRight') this.tab = TABS[(i + 1) % TABS.length].id;
    if (code === 'BracketLeft') this.tab = TABS[(i + TABS.length - 1) % TABS.length].id;
  }

  walkRects(fn) {
    for (const key in this.rects) {
      const entry = this.rects[key];
      if (Array.isArray(entry)) entry.forEach((r, i) => fn(`${key}:${i}`, r));
      else fn(key, entry);
    }
  }

  rectFor(key) {
    const [name, index] = key.split(':');
    const entry = this.rects[name];
    return index === undefined ? entry : entry[Number(index)];
  }

  activate(key) {
    const [name, indexStr] = key.split(':');
    const index = Number(indexStr);
    const guild = this.guild;

    if (name === 'tab') {
      this.tab = TABS[index].id;
      return;
    }
    if (name === 'descend') return this.descend();
    if (name === 'title') return this.app.openTitle();
    if (name === 'save') {
      this.app.save();
      this.say('Guild ledger written.');
      return;
    }

    if (name === 'roster') {
      const adv = this.rectFor(key).adv;
      this.selected = adv.id;
      return;
    }
    if (name === 'party') {
      const adv = this.rectFor(key).adv;
      const err = togglePartyMember(guild, adv.id);
      if (err) this.say(err);
      return;
    }
    if (name === 'hire') {
      const err = hire(guild, this.rng, this.rectFor(key).classId);
      this.say(err || 'Signed on. They look optimistic, which never lasts.');
      if (!err) this.selected = guild.roster[guild.roster.length - 1].id;
      return;
    }
    if (name === 'dismiss') {
      const adv = this.selectedAdv;
      if (adv) {
        dismiss(guild, adv.id);
        this.selected = guild.roster[0] ? guild.roster[0].id : null;
        this.say(`${adv.name} is let go, with feeling.`);
      }
      return;
    }
    if (name === 'slot') {
      const adv = this.selectedAdv;
      const slot = this.rectFor(key).slot;
      if (adv) this.say(unequip(guild, adv, slot) || 'Stowed.');
      return;
    }
    if (name === 'stash') {
      const adv = this.selectedAdv;
      const gearId = this.rectFor(key).gearId;
      if (!adv) return this.say('Pick somebody first.');
      const err = equip(guild, adv, gearId);
      this.say(err || `${adv.name} takes ${GEAR_BY_ID[gearId].name}.`);
      return;
    }
    if (name === 'sell') {
      const gearId = this.rectFor(key).gearId;
      this.say(sellGear(guild, gearId) || 'Sold to a man who asks no questions.');
      return;
    }
    if (name === 'deckAdd') {
      const cardId = this.rectFor(key).cardId;
      this.say(addToDeck(guild, cardId) || `${CARD_BY_ID[cardId].name} goes in the deck.`);
      return;
    }
    if (name === 'deckRemove') {
      const cardId = this.rectFor(key).cardId;
      this.say(removeFromDeck(guild, cardId) || 'Taken out.');
      return;
    }
    if (name === 'buy') {
      const entry = this.rectFor(key).entry;
      const err = buy(guild, entry);
      this.say(err || `Bought: ${entry.name}.`);
      return;
    }
  }

  descend() {
    const party = partyMembers(this.guild);
    if (!party.length) return this.say('Somebody has to go down there.');
    if (this.guild.deck.length < 6) return this.say('A deck that thin is not a dungeon. Add more rooms.');
    this.app.startExpedition();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  draw(ctx) {
    const W = this.app.width;
    const H = this.app.height;
    this.rects = {};

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#191522');
    g.addColorStop(1, '#0b0a11');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Header
    text(ctx, 'THE ADVENTURER GUILD', 40, 44, { size: 26, font: FONT_DISPLAY, color: '#e8d9b4' });
    const guild = this.guild;
    const facts = [
      `${guild.gold} gold`,
      `${guild.runs} expeditions`,
      `deepest ${guild.deepest}`,
      `${guild.fallen.length} on the wall`,
    ];
    text(ctx, facts.join('   ·   '), 40, 62, { size: 11, color: COLORS.gold });

    this.rects.title = { x: W - 260, y: 26, w: 74, h: 26 };
    button(ctx, this.rects.title, 'Title', { hover: this.hover === 'title', size: 11 });
    this.rects.save = { x: W - 178, y: 26, w: 74, h: 26 };
    button(ctx, this.rects.save, 'Save', { hover: this.hover === 'save', size: 11 });

    // Tabs
    this.rects.tab = TABS.map((t, i) => {
      const r = { x: 40 + i * 132, y: 78, w: 126, h: 28 };
      button(ctx, r, t.label, { hover: this.hover === `tab:${i}`, active: this.tab === t.id, size: 12 });
      return r;
    });

    const body = { x: 40, y: 118, w: W - 80, h: H - 118 - 66 };
    if (this.tab === 'roster') this.drawRoster(ctx, body);
    else if (this.tab === 'deck') this.drawDeck(ctx, body);
    else if (this.tab === 'shop') this.drawShop(ctx, body);
    else this.drawMemorial(ctx, body);

    // Footer
    const party = partyMembers(this.guild);
    text(
      ctx,
      `Party: ${party.length}/${PARTY_LIMIT} · Deck: ${this.guild.deck.length}/${DECK_LIMIT}`,
      40,
      H - 28,
      { size: 12, color: COLORS.dim },
    );
    this.rects.descend = { x: W - 260, y: H - 50, w: 220, h: 36 };
    button(ctx, this.rects.descend, 'Descend', {
      hover: this.hover === 'descend',
      size: 15,
      font: FONT_DISPLAY,
      disabled: !party.length || this.guild.deck.length < 6,
    });

    if (this.messageTimer > 0 && this.message) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.messageTimer * 2);
      const w = 460;
      panel(ctx, (W - w) / 2, H - 96, w, 28, { fill: 'rgba(14,12,20,0.95)' });
      text(ctx, this.message, W / 2, H - 77, { align: 'center', size: 12, color: COLORS.ink });
      ctx.restore();
    }
    vignette(ctx, W, H, 0.45);
  }

  // --- roster --------------------------------------------------------------

  drawRoster(ctx, body) {
    const guild = this.guild;
    const listW = 396;
    panel(ctx, body.x, body.y, listW, body.h);
    text(ctx, 'ON THE BOOKS', body.x + 16, body.y + 22, { size: 9, color: COLORS.faint });
    text(ctx, `${guild.roster.length}/${ROSTER_LIMIT}`, body.x + listW - 16, body.y + 22, {
      size: 9,
      color: COLORS.faint,
      align: 'right',
    });

    this.rects.roster = [];
    this.rects.party = [];
    const rowH = 58;
    const maxRows = Math.floor((body.h - 92) / rowH);
    this.scrollMax.roster = Math.max(0, (guild.roster.length - maxRows) * rowH);
    this.scroll.roster = clamp(this.scroll.roster, 0, this.scrollMax.roster);
    const offset = clamp(Math.round(this.scroll.roster / rowH), 0, Math.max(0, guild.roster.length - maxRows));
    guild.roster.slice(offset, offset + maxRows).forEach((adv, i) => {
      const r = { x: body.x + 12, y: body.y + 34 + i * rowH, w: listW - 24, h: rowH - 6, adv };
      this.rects.roster.push(r);
      const inParty = guild.party.includes(adv.id);
      const isSel = adv.id === this.selected;
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: isSel ? 'rgba(44, 38, 28, 0.95)' : 'rgba(22, 20, 28, 0.85)',
        edge: isSel ? COLORS.gold : inParty ? '#6a8a5a' : COLORS.edge,
      });
      const cls = CLASSES[adv.classId] || {};
      ctx.save();
      ctx.fillStyle = cls.color || '#888';
      roundRect(ctx, r.x + 10, r.y + 12, 26, 26, 4);
      ctx.fill();
      ctx.fillStyle = '#100f16';
      ctx.font = `bold 13px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText((cls.name || '?')[0], r.x + 23, r.y + 30);
      ctx.restore();

      text(ctx, adv.name, r.x + 46, r.y + 20, { size: 12, font: FONT_DISPLAY });
      text(ctx, `${cls.name} · L${adv.level} · ${adv.expeditions} runs · ${adv.kills} kills`, r.x + 46, r.y + 34, {
        size: 9,
        color: COLORS.dim,
      });
      const traitNames = adv.traits.map((t) => (TRAITS[t] || {}).name).filter(Boolean).join(', ');
      text(ctx, traitNames, r.x + 46, r.y + 46, { size: 9, color: COLORS.violet });

      const pr = { x: r.x + r.w - 70, y: r.y + 15, w: 60, h: 22, adv };
      this.rects.party.push(pr);
      button(ctx, pr, inParty ? 'Going' : 'Bench', {
        hover: this.hover === `party:${this.rects.party.length - 1}`,
        active: inParty,
        size: 10,
      });
    });

    // hire row
    const hy = body.y + body.h - 46;
    text(ctx, `Hire (${hireCost(guild)}g):`, body.x + 16, hy + 16, { size: 10, color: COLORS.dim });
    this.rects.hire = guild.classes.map((classId, i) => {
      const r = { x: body.x + 96 + i * 62, y: hy, w: 58, h: 24, classId };
      button(ctx, r, CLASSES[classId].name, {
        hover: this.hover === `hire:${i}`,
        size: 10,
        disabled: guild.gold < hireCost(guild) || guild.roster.length >= ROSTER_LIMIT,
      });
      return r;
    });

    // detail panel
    const dx = body.x + listW + 16;
    const dw = body.w - listW - 16;
    panel(ctx, dx, body.y, dw, body.h);
    const adv = this.selectedAdv;
    if (!adv) {
      text(ctx, 'Nobody selected.', dx + 16, body.y + 30, { size: 12, color: COLORS.dim });
      return;
    }
    const cls = CLASSES[adv.classId] || {};
    text(ctx, adv.name, dx + 16, body.y + 28, { size: 18, font: FONT_DISPLAY });
    text(ctx, `${cls.name} · level ${adv.level}`, dx + 16, body.y + 46, { size: 11, color: COLORS.gold });
    wrap(ctx, adv.hire || cls.blurb, dw - 32, { size: 10 }).forEach((line, i) =>
      text(ctx, line, dx + 16, body.y + 64 + i * 13, { size: 10, color: COLORS.dim }),
    );

    const statY = body.y + 104;
    const stats = [
      ['Health', `${adv.maxHp}`],
      ['Damage', `${adv.damage}`],
      ['Armour', `${adv.armor}`],
      ['Speed', `${adv.speed}`],
      ['Crit', `${Math.round(adv.crit * 100)}%`],
      ['Nerve', `leaves at ${Math.round(adv.fleeThreshold * 100)}%`],
    ];
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      text(ctx, s[0], dx + 16 + col * 180, statY + row * 18, { size: 10, color: COLORS.faint });
      text(ctx, s[1], dx + 80 + col * 180, statY + row * 18, { size: 11, color: COLORS.ink });
    });

    text(ctx, cls.strength || '', dx + 16, statY + 72, { size: 10, color: '#9fd08a' });
    text(ctx, cls.weakness || '', dx + 16, statY + 86, { size: 10, color: '#e0866a' });

    // traits
    let ty = statY + 110;
    text(ctx, 'TRAITS', dx + 16, ty, { size: 9, color: COLORS.faint });
    ty += 14;
    for (const id of adv.traits) {
      const t = TRAITS[id];
      if (!t) continue;
      text(ctx, t.name, dx + 16, ty, { size: 11, color: COLORS.violet });
      text(ctx, t.blurb, dx + 96, ty, { size: 10, color: COLORS.dim });
      ty += 16;
    }

    // gear
    ty += 10;
    text(ctx, 'CARRYING', dx + 16, ty, { size: 9, color: COLORS.faint });
    this.rects.slot = SLOTS.map((slot, i) => {
      const r = { x: dx + 16 + i * 128, y: ty + 8, w: 120, h: 34, slot };
      const gearId = adv.equipment[slot];
      const gear = gearId ? GEAR_BY_ID[gearId] : null;
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: 'rgba(18,16,24,0.9)',
        edge: this.hover === `slot:${i}` ? COLORS.edgeBright : COLORS.edge,
      });
      text(ctx, slot, r.x + 8, r.y + 13, { size: 8, color: COLORS.faint });
      text(ctx, gear ? gear.name : '—', r.x + 8, r.y + 27, {
        size: 10,
        color: gear ? GRADE_COLOR[gear.grade] : COLORS.faint,
      });
      return r;
    });

    // stash
    ty += 52;
    text(ctx, 'STASH — click to equip, or sell on the right', dx + 16, ty + 12, { size: 9, color: COLORS.faint });
    this.rects.stash = [];
    this.rects.sell = [];
    const unique = [...new Set(this.guild.stash)];
    const rows = Math.min(unique.length, Math.floor((body.y + body.h - ty - 60) / 22));
    unique.slice(0, rows).forEach((gearId, i) => {
      const gear = GEAR_BY_ID[gearId];
      const count = this.guild.stash.filter((s) => s === gearId).length;
      const r = { x: dx + 16, y: ty + 20 + i * 22, w: dw - 110, h: 20, gearId };
      this.rects.stash.push(r);
      if (this.hover === `stash:${i}`) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      text(ctx, `${gear.name}${count > 1 ? ` ×${count}` : ''}`, r.x + 4, r.y + 14, {
        size: 10,
        color: GRADE_COLOR[gear.grade],
      });
      const detail = [
        gear.damage ? `+${gear.damage} dmg` : null,
        gear.armor ? `+${gear.armor} arm` : null,
        gear.hp ? `+${gear.hp} hp` : null,
        gear.crit ? `+${Math.round(gear.crit * 100)}% crit` : null,
      ].filter(Boolean).join(' ');
      text(ctx, detail, r.x + 190, r.y + 14, { size: 9, color: COLORS.dim });
      const sr = { x: dx + dw - 86, y: r.y, w: 70, h: 20, gearId };
      this.rects.sell.push(sr);
      button(ctx, sr, 'Sell', { hover: this.hover === `sell:${i}`, size: 9 });
    });
    if (!unique.length) text(ctx, 'Empty. Go and fill it.', dx + 16, ty + 34, { size: 10, color: COLORS.faint });
    this.drawScrollHint(ctx, { x: body.x, y: body.y, w: listW, h: body.h }, 'roster');

    this.rects.dismiss = { x: dx + dw - 96, y: body.y + 14, w: 80, h: 22 };
    button(ctx, this.rects.dismiss, 'Dismiss', { hover: this.hover === 'dismiss', size: 10 });
  }

  // --- deck ----------------------------------------------------------------

  drawDeck(ctx, body) {
    const guild = this.guild;
    const leftW = body.w - 300;
    panel(ctx, body.x, body.y, leftW, body.h);
    text(ctx, 'CARDS YOU OWN — click to put one in the deck', body.x + 16, body.y + 22, {
      size: 9,
      color: COLORS.faint,
    });

    const owned = CARDS.filter((c) => ownedCopies(guild, c.id) > 0);
    const cardW = 92;
    const cardH = 132;
    const perRow = Math.max(1, Math.floor((leftW - 24) / (cardW + 10)));
    const deckRows = Math.ceil(owned.length / perRow);
    this.scrollMax.deck = Math.max(0, deckRows * (cardH + 10) - (body.h - 46));
    this.scroll.deck = clamp(this.scroll.deck, 0, this.scrollMax.deck);
    this.rects.deckAdd = [];
    owned.forEach((card, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const r = {
        x: body.x + 14 + col * (cardW + 10),
        y: body.y + 34 + row * (cardH + 10) - this.scroll.deck,
        w: cardW,
        h: cardH,
        cardId: card.id,
      };
      if (r.y < body.y + 28 || r.y + r.h > body.y + body.h - 6) return;
      this.rects.deckAdd.push(r);
      const inDeck = copiesInDeck(guild, card.id);
      drawCard(ctx, r, { card }, {
        hover: this.hover === `deckAdd:${this.rects.deckAdd.length - 1}`,
        count: ownedCopies(guild, card.id),
        disabled: inDeck >= ownedCopies(guild, card.id),
        showBlurb: false,
      });
      if (inDeck) {
        text(ctx, `${inDeck} in deck`, r.x + cardW / 2, r.y + cardH - 6, {
          align: 'center',
          size: 9,
          color: '#9fd08a',
        });
      }
    });

    // deck list
    const dx = body.x + leftW + 16;
    const dw = body.w - leftW - 16;
    panel(ctx, dx, body.y, dw, body.h);
    text(ctx, `EXPEDITION DECK ${guild.deck.length}/${DECK_LIMIT}`, dx + 16, body.y + 22, {
      size: 9,
      color: COLORS.faint,
    });
    const counts = {};
    for (const id of guild.deck) counts[id] = (counts[id] || 0) + 1;
    this.rects.deckRemove = [];
    Object.entries(counts).forEach(([cardId, n], i) => {
      const card = CARD_BY_ID[cardId];
      const r = { x: dx + 12, y: body.y + 34 + i * 24, w: dw - 24, h: 22, cardId };
      if (r.y + r.h > body.y + body.h - 90) return;
      this.rects.deckRemove.push(r);
      if (this.hover === `deckRemove:${this.rects.deckRemove.length - 1}`) {
        ctx.fillStyle = 'rgba(255, 120, 100, 0.12)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      text(ctx, `${n}×`, r.x + 6, r.y + 15, { size: 10, color: COLORS.gold });
      text(ctx, card.name, r.x + 28, r.y + 15, { size: 11 });
      if (card.threat) {
        text(ctx, `T${card.threat}`, r.x + r.w - 8, r.y + 15, {
          size: 10,
          color: card.threat > 5 ? '#e0866a' : COLORS.dim,
          align: 'right',
        });
      }
    });

    const totalThreat = guild.deck.reduce((a, id) => a + (CARD_BY_ID[id].threat || 0), 0);
    const tags = {};
    for (const id of guild.deck) for (const tag of CARD_BY_ID[id].tags) tags[tag] = (tags[tag] || 0) + 1;
    const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 4);
    text(ctx, `Printed Threat in this deck: ${totalThreat}`, dx + 14, body.y + body.h - 62, {
      size: 10,
      color: totalThreat > 60 ? '#e0866a' : COLORS.dim,
    });
    text(ctx, top.length ? `Leans: ${top.map(([t, n]) => `${t} ×${n}`).join(', ')}` : 'No tags in this deck yet.',
      dx + 14, body.y + body.h - 46, { size: 10, color: COLORS.violet });
    text(ctx, 'Matching tags next to each other make biomes.', dx + 14, body.y + body.h - 30, {
      size: 9,
      color: COLORS.faint,
    });
    this.drawScrollHint(ctx, { x: body.x, y: body.y, w: leftW, h: body.h }, 'deck');
  }

  // --- shop ----------------------------------------------------------------

  drawShop(ctx, body) {
    const guild = this.guild;
    panel(ctx, body.x, body.y, body.w, body.h);
    text(ctx, 'REQUISITIONS — gold buys cards, people and standing arrangements', body.x + 16, body.y + 22, {
      size: 9,
      color: COLORS.faint,
    });

    const entries = [...UPGRADES, ...CLASS_SHOP, ...CARD_SHOP];
    const colW = (body.w - 40) / 3;
    const rowH = 78;
    this.scrollMax.shop = Math.max(0, Math.ceil(entries.length / 3) * rowH - (body.h - 46));
    this.scroll.shop = clamp(this.scroll.shop, 0, this.scrollMax.shop);
    this.rects.buy = [];
    entries.forEach((entry, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const r = {
        x: body.x + 14 + col * colW,
        y: body.y + 34 + row * rowH - this.scroll.shop,
        w: colW - 12,
        h: rowH - 10,
        entry,
      };
      if (r.y < body.y + 28 || r.y + r.h > body.y + body.h - 6) return;
      this.rects.buy.push(r);
      const reason = canBuy(guild, entry);
      const owned =
        entry.kind === 'card' ? ownedCopies(guild, entry.id)
          : entry.kind === 'upgrade' ? (guild.upgrades.includes(entry.id) ? 1 : 0)
            : guild.classes.includes(entry.id) ? 1 : 0;
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: owned ? 'rgba(24, 30, 22, 0.85)' : 'rgba(20, 18, 26, 0.85)',
        edge: this.hover === `buy:${this.rects.buy.length - 1}` && !reason ? COLORS.gold : COLORS.edge,
      });
      const kindColor = entry.kind === 'upgrade' ? COLORS.blue : entry.kind === 'class' ? COLORS.green : COLORS.violet;
      text(ctx, entry.kind.toUpperCase(), r.x + 10, r.y + 15, { size: 7, color: kindColor });
      text(ctx, entry.name, r.x + 10, r.y + 30, { size: 12, font: FONT_DISPLAY });
      wrap(ctx, entry.blurb || '', r.w - 20, { size: 9 }).slice(0, 2).forEach((line, k) =>
        text(ctx, line, r.x + 10, r.y + 44 + k * 11, { size: 9, color: COLORS.dim }),
      );
      text(ctx, `${entry.cost}g`, r.x + r.w - 10, r.y + 15, {
        size: 12,
        align: 'right',
        color: guild.gold >= entry.cost ? COLORS.gold : '#8a6a5a',
        weight: 'bold',
      });
      if (owned) {
        text(ctx, entry.kind === 'card' ? `owned ×${owned}` : 'owned', r.x + r.w - 10, r.y + r.h - 8, {
          size: 9,
          align: 'right',
          color: '#9fd08a',
        });
      }
    });
    this.drawScrollHint(ctx, body, 'shop');
  }

  /** A thin bar on the right edge, so a clipped list does not look finished. */
  drawScrollHint(ctx, body, tab) {
    const max = this.scrollMax[tab] || 0;
    if (max <= 0) return;
    const trackH = body.h - 24;
    const thumbH = Math.max(24, trackH * (trackH / (trackH + max)));
    const t = this.scroll[tab] / max;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(body.x + body.w - 8, body.y + 12, 3, trackH);
    ctx.fillStyle = 'rgba(230, 200, 140, 0.35)';
    ctx.fillRect(body.x + body.w - 8, body.y + 12 + (trackH - thumbH) * t, 3, thumbH);
    ctx.restore();
    text(ctx, 'scroll', body.x + body.w - 44, body.y + body.h - 6, { size: 8, color: COLORS.faint });
  }

  // --- memorial ------------------------------------------------------------

  drawMemorial(ctx, body) {
    const guild = this.guild;
    const leftW = body.w * 0.52;
    panel(ctx, body.x, body.y, leftW, body.h);
    text(ctx, 'THE WALL', body.x + 16, body.y + 24, { size: 12, font: FONT_DISPLAY, color: '#d5a0a4' });
    if (!guild.fallen.length) {
      text(ctx, 'Empty, for now. Give it time.', body.x + 16, body.y + 48, { size: 11, color: COLORS.dim });
    }
    guild.fallen.slice(-14).reverse().forEach((f, i) => {
      const y = body.y + 48 + i * 30;
      if (y > body.y + body.h - 20) return;
      const cls = CLASSES[f.classId] || {};
      text(ctx, f.name, body.x + 16, y, { size: 12, font: FONT_DISPLAY, color: '#c9a0a4' });
      text(ctx, `${cls.name || '?'} · level ${f.level} · ${f.expeditions} expeditions`, body.x + 16, y + 13, {
        size: 9,
        color: COLORS.faint,
      });
      text(ctx, `fell in ${f.room}, ${f.depth} deep`, body.x + leftW - 16, y + 6, {
        size: 10,
        align: 'right',
        color: '#8a6066',
      });
    });

    const rx = body.x + leftW + 16;
    const rw = body.w - leftW - 16;
    panel(ctx, rx, body.y, rw, body.h);
    text(ctx, 'THE LEDGER', rx + 16, body.y + 24, { size: 12, font: FONT_DISPLAY, color: COLORS.gold });
    let y = body.y + 48;
    for (const line of guild.story.slice(-14).reverse()) {
      const lines = wrap(ctx, line, rw - 32, { size: 10 });
      if (y + lines.length * 13 > body.y + body.h - 10) break;
      lines.forEach((l, i) => text(ctx, l, rx + 16, y + i * 13, { size: 10, color: COLORS.dim }));
      y += lines.length * 13 + 6;
    }
    if (!guild.story.length) text(ctx, 'No expeditions yet.', rx + 16, y, { size: 11, color: COLORS.faint });
  }
}

