// The Adventurer Guild — everything between expeditions. Who goes down, what is
// in the deck, what the gold buys, and the names on the wall.
//
// On a wide screen the roster sits beside a detail panel. On a phone the detail
// becomes a sheet that slides over the list, because two columns of this much
// text at 390 points is unreadable and nobody would use it.

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
  { id: 'roster', label: 'Roster', short: 'Roster' },
  { id: 'deck', label: 'Dungeon Deck', short: 'Deck' },
  { id: 'shop', label: 'Requisitions', short: 'Buy' },
  { id: 'memorial', label: 'The Wall', short: 'Wall' },
];

export class GuildScene {
  constructor(app, { guild, rng }) {
    this.app = app;
    this.guild = guild;
    this.rng = rng;
    this.tab = 'roster';
    this.hover = null;
    this.rects = {};
    this.scroll = { roster: 0, deck: 0, shop: 0, memorial: 0, sheet: 0 };
    this.scrollMax = { roster: 0, deck: 0, shop: 0, memorial: 0, sheet: 0 };
    this.selected = guild.roster[0] ? guild.roster[0].id : null;
    this.sheet = null;
    this.message = null;
    this.messageTimer = 0;
    this.time = 0;
  }

  get compact() {
    return this.app.compact;
  }

  /**
   * The roster detail needs about 380 points of height. Below that it goes in a
   * sheet instead of beside the list, or it overflows its panel and drops its
   * controls on top of the footer.
   */
  detailAsSheet(bodyHeight) {
    return this.compact || bodyHeight < 380;
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

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  get scrollKey() {
    return this.sheet ? 'sheet' : this.tab;
  }

  onWheel(delta) {
    this.scrollBy(delta > 0 ? 46 : -46);
  }

  onDragStart() {
    return 'scroll';
  }

  onDragScroll(dy) {
    this.scrollBy(-dy);
  }

  scrollBy(amount) {
    const key = this.scrollKey;
    this.scroll[key] = clamp(this.scroll[key] + amount, 0, this.scrollMax[key] || 0);
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
      if (!handled && hit(rect, x, y)) handled = key;
    });
    if (handled) {
      this.activate(handled);
      return;
    }
    // A tap on the dimmed area behind a sheet puts it away.
    if (this.sheet) this.sheet = null;
  }

  onKeyDown(code) {
    if (code === 'Escape') {
      if (this.sheet) this.sheet = null;
      else this.app.openTitle();
      return;
    }
    if (code === 'Enter') this.descend();
    const i = TABS.findIndex((t) => t.id === this.tab);
    if (code === 'BracketRight') this.setTab(TABS[(i + 1) % TABS.length].id);
    if (code === 'BracketLeft') this.setTab(TABS[(i + TABS.length - 1) % TABS.length].id);
  }

  setTab(id) {
    this.tab = id;
    this.sheet = null;
  }

  walkRects(fn) {
    for (const key in this.rects) {
      const entry = this.rects[key];
      if (!entry) continue;
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
    const rect = this.rectFor(key);

    if (name === 'tab') return this.setTab(TABS[index].id);
    if (name === 'descend') return this.descend();
    if (name === 'title') return this.app.openTitle();
    if (name === 'closeSheet') {
      this.sheet = null;
      return;
    }
    if (name === 'roster') {
      this.selected = rect.adv.id;
      if (this.useSheet) {
        this.sheet = { kind: 'adventurer' };
        this.scroll.sheet = 0;
      }
      return;
    }
    if (name === 'party') {
      const err = togglePartyMember(guild, rect.adv.id);
      if (err) this.say(err);
      return;
    }
    if (name === 'hire') {
      const err = hire(guild, this.rng, rect.classId);
      this.say(err || 'Signed on. They look optimistic, which never lasts.');
      if (!err) this.selected = guild.roster[guild.roster.length - 1].id;
      return;
    }
    if (name === 'dismiss') {
      const adv = this.selectedAdv;
      if (adv) {
        dismiss(guild, adv.id);
        this.selected = guild.roster[0] ? guild.roster[0].id : null;
        this.sheet = null;
        this.say(`${adv.name} is let go, with feeling.`);
      }
      return;
    }
    if (name === 'slot') {
      const adv = this.selectedAdv;
      if (adv) this.say(unequip(guild, adv, rect.slot) || 'Stowed.');
      return;
    }
    if (name === 'stash') {
      const adv = this.selectedAdv;
      if (!adv) return this.say('Pick somebody first.');
      const err = equip(guild, adv, rect.gearId);
      this.say(err || `${adv.name} takes ${GEAR_BY_ID[rect.gearId].name}.`);
      return;
    }
    if (name === 'sell') {
      this.say(sellGear(guild, rect.gearId) || 'Sold to a man who asks no questions.');
      return;
    }
    if (name === 'deckAdd') {
      this.say(addToDeck(guild, rect.cardId) || `${CARD_BY_ID[rect.cardId].name} goes in the deck.`);
      return;
    }
    if (name === 'deckRemove') {
      this.say(removeFromDeck(guild, rect.cardId) || 'Taken out.');
      return;
    }
    if (name === 'showDeck') {
      this.sheet = { kind: 'deck' };
      this.scroll.sheet = 0;
      return;
    }
    if (name === 'buy') {
      const err = buy(guild, rect.entry);
      this.say(err || `Bought: ${rect.entry.name}.`);
    }
  }

  descend() {
    if (!partyMembers(this.guild).length) return this.say('Somebody has to go down there.');
    if (this.guild.deck.length < 6) return this.say('A deck that thin is not a dungeon. Add more rooms.');
    this.app.startExpedition();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  draw(ctx) {
    const W = this.app.width;
    const H = this.app.height;
    const compact = this.compact;
    this.rects = {};

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#191522');
    g.addColorStop(1, '#0b0a11');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const pad = compact ? 10 : 40;
    const guild = this.guild;

    if (compact) {
      text(ctx, 'THE ADVENTURER GUILD', pad, 30, { size: 17, font: FONT_DISPLAY, color: '#e8d9b4' });
      text(ctx, `${guild.gold} gold · ${guild.runs} runs · deepest ${guild.deepest} · ${guild.fallen.length} on the wall`,
        pad, 47, { size: 10, color: COLORS.gold });
      this.rects.title = { x: W - pad - 54, y: 12, w: 54, h: 26 };
      button(ctx, this.rects.title, 'Title', { hover: this.hover === 'title', size: 10 });
    } else {
      text(ctx, 'THE ADVENTURER GUILD', pad, 44, { size: 26, font: FONT_DISPLAY, color: '#e8d9b4' });
      const facts = [`${guild.gold} gold`, `${guild.runs} expeditions`, `deepest ${guild.deepest}`,
        `${guild.fallen.length} on the wall`];
      text(ctx, facts.join('   ·   '), pad, 62, { size: 11, color: COLORS.gold });
      this.rects.title = { x: W - 124, y: 26, w: 84, h: 26 };
      button(ctx, this.rects.title, 'Title', { hover: this.hover === 'title', size: 11 });
    }

    const tabY = compact ? 58 : 78;
    const tabH = compact ? 34 : 28;
    const tabW = compact ? (W - pad * 2 - 18) / TABS.length : 126;
    this.rects.tab = TABS.map((t, i) => {
      const r = { x: pad + i * (tabW + 6), y: tabY, w: tabW, h: tabH };
      button(ctx, r, compact ? t.short : t.label, {
        hover: this.hover === `tab:${i}`,
        active: this.tab === t.id,
        size: compact ? 12 : 12,
      });
      return r;
    });

    const footerH = compact ? 58 : 66;
    const body = { x: pad, y: tabY + tabH + (compact ? 10 : 12), w: W - pad * 2, h: 0 };
    body.h = H - body.y - footerH;

    if (this.tab === 'roster') this.drawRoster(ctx, body);
    else if (this.tab === 'deck') this.drawDeck(ctx, body);
    else if (this.tab === 'shop') this.drawShop(ctx, body);
    else this.drawMemorial(ctx, body);

    // Footer
    const party = partyMembers(this.guild);
    const ready = party.length && this.guild.deck.length >= 6;
    if (compact) {
      text(ctx, `Party ${party.length}/${PARTY_LIMIT}  ·  Deck ${this.guild.deck.length}/${DECK_LIMIT}`,
        pad, H - 36, { size: 11, color: COLORS.dim });
      this.rects.descend = { x: pad, y: H - 30, w: W - pad * 2, h: 24 };
    } else {
      text(ctx, `Party: ${party.length}/${PARTY_LIMIT} · Deck: ${this.guild.deck.length}/${DECK_LIMIT}`,
        pad, H - 28, { size: 12, color: COLORS.dim });
      this.rects.descend = { x: W - 260, y: H - 50, w: 220, h: 36 };
    }
    button(ctx, this.rects.descend, 'Descend', {
      hover: this.hover === 'descend',
      size: compact ? 14 : 15,
      font: FONT_DISPLAY,
      disabled: !ready,
    });

    if (this.sheet) this.drawSheet(ctx, W, H);

    if (this.messageTimer > 0 && this.message) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.messageTimer * 2);
      const w = Math.min(460, W - 24);
      const y = compact ? H - 96 : H - 96;
      panel(ctx, (W - w) / 2, y, w, 30, { fill: 'rgba(14,12,20,0.96)' });
      wrap(ctx, this.message, w - 20, { size: 11 }).slice(0, 1).forEach((line) =>
        text(ctx, line, W / 2, y + 20, { align: 'center', size: 11, color: COLORS.ink }),
      );
      ctx.restore();
    }
    vignette(ctx, W, H, 0.45);
  }

  /** A thin bar on the right edge, so a clipped list does not look finished. */
  drawScrollHint(ctx, body, key) {
    const max = this.scrollMax[key] || 0;
    if (max <= 0) return;
    const trackH = body.h - 24;
    const thumbH = Math.max(24, trackH * (trackH / (trackH + max)));
    const t = (this.scroll[key] || 0) / max;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(body.x + body.w - 6, body.y + 12, 3, trackH);
    ctx.fillStyle = 'rgba(230, 200, 140, 0.4)';
    ctx.fillRect(body.x + body.w - 6, body.y + 12 + (trackH - thumbH) * t, 3, thumbH);
    ctx.restore();
  }

  // --- roster --------------------------------------------------------------

  drawRoster(ctx, body) {
    const guild = this.guild;
    const compact = this.compact;
    this.useSheet = this.detailAsSheet(body.h);
    const listW = this.useSheet ? body.w : 396;

    panel(ctx, body.x, body.y, listW, body.h);
    text(ctx, 'ON THE BOOKS', body.x + 14, body.y + 20, { size: 9, color: COLORS.faint });
    text(ctx, `${guild.roster.length}/${ROSTER_LIMIT}`, body.x + listW - 14, body.y + 20, {
      size: 9,
      color: COLORS.faint,
      align: 'right',
    });

    this.rects.roster = [];
    this.rects.party = [];
    const rowH = compact ? 66 : 58;
    const listTop = body.y + 30;
    const listBottom = body.y + body.h - 46;
    const visible = Math.max(1, Math.floor((listBottom - listTop) / rowH));
    this.scrollMax.roster = Math.max(0, (guild.roster.length - visible) * rowH);
    this.scroll.roster = clamp(this.scroll.roster, 0, this.scrollMax.roster);
    const offset = Math.round(this.scroll.roster / rowH);

    guild.roster.slice(offset, offset + visible).forEach((adv, i) => {
      const r = { x: body.x + 10, y: listTop + i * rowH, w: listW - 20, h: rowH - 6, adv };
      this.rects.roster.push(r);
      const inParty = guild.party.includes(adv.id);
      const isSel = adv.id === this.selected && !this.useSheet;
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
      if (compact) {
        text(ctx, 'tap for details', r.x + 46, r.y + 58, { size: 8, color: COLORS.faint });
      }

      const pw = compact ? 64 : 60;
      const pr = { x: r.x + r.w - pw - 10, y: r.y + (r.h - 26) / 2, w: pw, h: 26, adv };
      this.rects.party.push(pr);
      button(ctx, pr, inParty ? 'Going' : 'Bench', {
        hover: this.hover === `party:${this.rects.party.length - 1}`,
        active: inParty,
        size: 10,
      });
    });
    this.drawScrollHint(ctx, { x: body.x, y: body.y, w: listW, h: body.h }, 'roster');

    const hy = body.y + body.h - 38;
    text(ctx, `Hire ${hireCost(guild)}g:`, body.x + 14, hy + 17, { size: 10, color: COLORS.dim });
    const hw = compact ? (listW - 96) / guild.classes.length - 4 : 58;
    this.rects.hire = guild.classes.map((classId, i) => {
      const r = { x: body.x + 84 + i * (hw + 4), y: hy, w: hw, h: 26, classId };
      button(ctx, r, CLASSES[classId].name, {
        hover: this.hover === `hire:${i}`,
        size: 10,
        disabled: guild.gold < hireCost(guild) || guild.roster.length >= ROSTER_LIMIT,
      });
      return r;
    });

    if (!this.useSheet) {
      const dx = body.x + listW + 16;
      this.drawAdventurerDetail(ctx, { x: dx, y: body.y, w: body.w - listW - 16, h: body.h });
    }
  }

  /** The full write-up: stats, traits, what they are carrying, the stash. */
  drawAdventurerDetail(ctx, box, insideSheet = false) {
    const guild = this.guild;
    if (!insideSheet) panel(ctx, box.x, box.y, box.w, box.h);
    const adv = this.selectedAdv;
    if (!adv) {
      text(ctx, 'Nobody selected.', box.x + 16, box.y + 30, { size: 12, color: COLORS.dim });
      return;
    }
    // A control drawn past the bottom of its panel is a control sitting on top
    // of whatever is underneath — so it is neither drawn nor clickable.
    const fits = (r) => r.y >= box.y && r.y + r.h <= box.y + box.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    const cls = CLASSES[adv.classId] || {};
    const pad = 16;
    text(ctx, adv.name, box.x + pad, box.y + 26, { size: 17, font: FONT_DISPLAY });
    text(ctx, `${cls.name} · level ${adv.level}`, box.x + pad, box.y + 44, { size: 11, color: COLORS.gold });
    let cy = box.y + 60;
    wrap(ctx, adv.hire || cls.blurb, box.w - pad * 2, { size: 10 }).slice(0, 2).forEach((line, i) =>
      text(ctx, line, box.x + pad, cy + i * 13, { size: 10, color: COLORS.dim }),
    );
    cy += 30;

    const stats = [
      ['Health', `${adv.maxHp}`], ['Damage', `${adv.damage}`],
      ['Armour', `${adv.armor}`], ['Speed', `${adv.speed}`],
      ['Crit', `${Math.round(adv.crit * 100)}%`], ['Nerve', `leaves at ${Math.round(adv.fleeThreshold * 100)}%`],
    ];
    const colW = (box.w - pad * 2) / 2;
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      text(ctx, s[0], box.x + pad + col * colW, cy + row * 18, { size: 10, color: COLORS.faint });
      text(ctx, s[1], box.x + pad + 62 + col * colW, cy + row * 18, { size: 11, color: COLORS.ink });
    });
    cy += 60;

    wrap(ctx, cls.strength || '', box.w - pad * 2, { size: 10 }).forEach((line, i) =>
      text(ctx, line, box.x + pad, cy + i * 13, { size: 10, color: '#9fd08a' }),
    );
    cy += 16;
    wrap(ctx, cls.weakness || '', box.w - pad * 2, { size: 10 }).forEach((line, i) =>
      text(ctx, line, box.x + pad, cy + i * 13, { size: 10, color: '#e0866a' }),
    );
    cy += 26;

    text(ctx, 'TRAITS', box.x + pad, cy, { size: 9, color: COLORS.faint });
    cy += 15;
    for (const id of adv.traits) {
      const t = TRAITS[id];
      if (!t) continue;
      text(ctx, t.name, box.x + pad, cy, { size: 11, color: COLORS.violet });
      const lines = wrap(ctx, t.blurb, box.w - pad * 2 - 86, { size: 10 }).slice(0, 2);
      lines.forEach((line, i) => text(ctx, line, box.x + pad + 86, cy + i * 12, { size: 10, color: COLORS.dim }));
      cy += Math.max(16, lines.length * 12 + 4);
    }

    cy += 10;
    text(ctx, 'CARRYING — tap a slot to stow it', box.x + pad, cy, { size: 9, color: COLORS.faint });
    cy += 8;
    const slotW = (box.w - pad * 2 - 12) / 3;
    this.rects.slot = [];
    SLOTS.forEach((slot, i) => {
      const r = { x: box.x + pad + i * (slotW + 6), y: cy, w: slotW, h: 36, slot };
      if (!fits(r)) return;
      this.rects.slot.push(r);
      const gearId = adv.equipment[slot];
      const gear = gearId ? GEAR_BY_ID[gearId] : null;
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: 'rgba(18,16,24,0.9)',
        edge: this.hover === `slot:${i}` ? COLORS.edgeBright : COLORS.edge,
      });
      text(ctx, slot, r.x + 8, r.y + 13, { size: 8, color: COLORS.faint });
      wrap(ctx, gear ? gear.name : '—', r.w - 12, { size: 10 }).slice(0, 1).forEach((line) =>
        text(ctx, line, r.x + 8, r.y + 28, { size: 10, color: gear ? GRADE_COLOR[gear.grade] : COLORS.faint }),
      );
    });
    cy += 48;

    text(ctx, 'STASH — tap to equip', box.x + pad, cy, { size: 9, color: COLORS.faint });
    cy += 8;
    this.rects.stash = [];
    this.rects.sell = [];
    const unique = [...new Set(guild.stash)];
    const rowH = 26;
    const room = Math.max(0, Math.floor((box.y + box.h - cy - 46) / rowH));
    unique.slice(0, room).forEach((gearId, i) => {
      const gear = GEAR_BY_ID[gearId];
      const count = guild.stash.filter((s) => s === gearId).length;
      const r = { x: box.x + pad, y: cy + i * rowH, w: box.w - pad * 2 - 78, h: rowH - 2, gearId };
      if (!fits(r)) return;
      this.rects.stash.push(r);
      if (this.hover === `stash:${i}`) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      text(ctx, `${gear.name}${count > 1 ? ` ×${count}` : ''}`, r.x + 4, r.y + 16, {
        size: 10,
        color: GRADE_COLOR[gear.grade],
      });
      const detail = [
        gear.damage ? `+${gear.damage} dmg` : null,
        gear.armor ? `+${gear.armor} arm` : null,
        gear.hp ? `+${gear.hp} hp` : null,
      ].filter(Boolean).join(' ');
      text(ctx, detail, r.x + r.w - 4, r.y + 16, { size: 9, color: COLORS.dim, align: 'right' });
      const sr = { x: box.x + box.w - pad - 68, y: r.y, w: 68, h: rowH - 2, gearId };
      this.rects.sell.push(sr);
      button(ctx, sr, 'Sell', { hover: this.hover === `sell:${i}`, size: 9 });
    });
    if (!unique.length) text(ctx, 'Empty. Go and fill it.', box.x + pad, cy + 14, { size: 10, color: COLORS.faint });

    this.rects.dismiss = { x: box.x + box.w - pad - 80, y: box.y + 12, w: 80, h: 24 };
    button(ctx, this.rects.dismiss, 'Dismiss', { hover: this.hover === 'dismiss', size: 10 });
    ctx.restore();
  }

  // --- deck ----------------------------------------------------------------

  drawDeck(ctx, body) {
    const guild = this.guild;
    const compact = this.compact;
    const leftW = compact ? body.w : body.w - 300;

    panel(ctx, body.x, body.y, leftW, body.h);
    text(ctx, compact ? 'TAP A CARD TO ADD IT TO THE DECK' : 'CARDS YOU OWN — click to put one in the deck',
      body.x + 14, body.y + 20, { size: 9, color: COLORS.faint });

    const owned = CARDS.filter((c) => ownedCopies(guild, c.id) > 0);
    const cardW = compact ? Math.min(104, (leftW - 40) / 3) : 92;
    const cardH = cardW * 1.44;
    const perRow = Math.max(1, Math.floor((leftW - 24) / (cardW + 10)));
    const top = body.y + 30;
    const bottom = body.y + body.h - (compact ? 44 : 6);
    const rows = Math.ceil(owned.length / perRow);
    this.scrollMax.deck = Math.max(0, rows * (cardH + 10) - (bottom - top));
    this.scroll.deck = clamp(this.scroll.deck, 0, this.scrollMax.deck);

    this.rects.deckAdd = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(body.x, top - 2, leftW, bottom - top + 2);
    ctx.clip();
    owned.forEach((card, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const r = {
        x: body.x + 14 + col * (cardW + 10),
        y: top + row * (cardH + 10) - this.scroll.deck,
        w: cardW,
        h: cardH,
        cardId: card.id,
      };
      if (r.y + r.h < top || r.y > bottom) return;
      this.rects.deckAdd.push(r);
      const inDeck = copiesInDeck(guild, card.id);
      drawCard(ctx, r, { card }, {
        hover: this.hover === `deckAdd:${this.rects.deckAdd.length - 1}`,
        count: ownedCopies(guild, card.id),
        disabled: inDeck >= ownedCopies(guild, card.id),
        showBlurb: false,
        footer: inDeck ? `${inDeck} in deck` : 'tap to add',
        footerColor: inDeck ? '#9fd08a' : COLORS.faint,
      });
    });
    ctx.restore();
    this.drawScrollHint(ctx, { x: body.x, y: body.y, w: leftW, h: body.h }, 'deck');

    if (compact) {
      this.rects.showDeck = { x: body.x + 10, y: body.y + body.h - 38, w: leftW - 20, h: 30 };
      button(ctx, this.rects.showDeck, `Your deck — ${guild.deck.length}/${DECK_LIMIT}`, {
        hover: this.hover === 'showDeck',
        size: 12,
      });
      return;
    }

    const dx = body.x + leftW + 16;
    this.drawDeckList(ctx, { x: dx, y: body.y, w: body.w - leftW - 16, h: body.h });
  }

  drawDeckList(ctx, box, insideSheet = false) {
    const guild = this.guild;
    if (!insideSheet) panel(ctx, box.x, box.y, box.w, box.h);
    text(ctx, `EXPEDITION DECK ${guild.deck.length}/${DECK_LIMIT} — tap to take one out`, box.x + 14, box.y + 20, {
      size: 9,
      color: COLORS.faint,
    });
    const counts = {};
    for (const id of guild.deck) counts[id] = (counts[id] || 0) + 1;
    this.rects.deckRemove = [];
    const rowH = this.compact ? 30 : 24;
    const footer = 78;
    Object.entries(counts).forEach(([cardId, n], i) => {
      const card = CARD_BY_ID[cardId];
      const r = { x: box.x + 12, y: box.y + 30 + i * rowH, w: box.w - 24, h: rowH - 2, cardId };
      if (r.y + r.h > box.y + box.h - footer) return;
      this.rects.deckRemove.push(r);
      if (this.hover === `deckRemove:${this.rects.deckRemove.length - 1}`) {
        ctx.fillStyle = 'rgba(255, 120, 100, 0.12)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      text(ctx, `${n}×`, r.x + 6, r.y + rowH / 2 + 4, { size: 10, color: COLORS.gold });
      text(ctx, card.name, r.x + 28, r.y + rowH / 2 + 4, { size: 11 });
      if (card.threat) {
        text(ctx, `T${card.threat}`, r.x + r.w - 8, r.y + rowH / 2 + 4, {
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
    const fy = box.y + box.h - 62;
    text(ctx, `Printed Threat in this deck: ${totalThreat}`, box.x + 14, fy, {
      size: 10,
      color: totalThreat > 60 ? '#e0866a' : COLORS.dim,
    });
    wrap(ctx, top.length ? `Leans: ${top.map(([t, n]) => `${t} ×${n}`).join(', ')}` : 'No tags in this deck yet.',
      box.w - 28, { size: 10 }).slice(0, 1).forEach((line) =>
      text(ctx, line, box.x + 14, fy + 16, { size: 10, color: COLORS.violet }),
    );
    text(ctx, 'Matching tags next to each other make biomes.', box.x + 14, fy + 32, {
      size: 9,
      color: COLORS.faint,
    });
  }

  // --- shop ----------------------------------------------------------------

  drawShop(ctx, body) {
    const guild = this.guild;
    const compact = this.compact;
    panel(ctx, body.x, body.y, body.w, body.h);
    text(ctx, compact ? 'GOLD BUYS CARDS, PEOPLE AND ARRANGEMENTS' : 'REQUISITIONS — gold buys cards, people and standing arrangements',
      body.x + 14, body.y + 20, { size: 9, color: COLORS.faint });

    const entries = [...UPGRADES, ...CLASS_SHOP, ...CARD_SHOP];
    const cols = compact ? 1 : 3;
    const colW = (body.w - 28) / cols;
    const rowH = compact ? 86 : 78;
    const top = body.y + 30;
    const bottom = body.y + body.h - 6;
    this.scrollMax.shop = Math.max(0, Math.ceil(entries.length / cols) * rowH - (bottom - top));
    this.scroll.shop = clamp(this.scroll.shop, 0, this.scrollMax.shop);

    this.rects.buy = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(body.x, top - 2, body.w, bottom - top + 2);
    ctx.clip();
    entries.forEach((entry, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r = {
        x: body.x + 14 + col * colW,
        y: top + row * rowH - this.scroll.shop,
        w: colW - 12,
        h: rowH - 10,
        entry,
      };
      if (r.y + r.h < top || r.y > bottom) return;
      this.rects.buy.push(r);
      const reason = canBuy(guild, entry);
      const owned = entry.kind === 'card' ? ownedCopies(guild, entry.id)
        : entry.kind === 'upgrade' ? (guild.upgrades.includes(entry.id) ? 1 : 0)
          : guild.classes.includes(entry.id) ? 1 : 0;
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: owned ? 'rgba(24, 30, 22, 0.85)' : 'rgba(20, 18, 26, 0.85)',
        edge: this.hover === `buy:${this.rects.buy.length - 1}` && !reason ? COLORS.gold : COLORS.edge,
      });
      const kindColor = entry.kind === 'upgrade' ? COLORS.blue : entry.kind === 'class' ? COLORS.green : COLORS.violet;
      text(ctx, entry.kind.toUpperCase(), r.x + 10, r.y + 15, { size: 7, color: kindColor });
      text(ctx, entry.name, r.x + 10, r.y + 30, { size: 12, font: FONT_DISPLAY });
      wrap(ctx, entry.blurb || '', r.w - 90, { size: 9 }).slice(0, 2).forEach((line, k) =>
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
    ctx.restore();
    this.drawScrollHint(ctx, body, 'shop');
  }

  // --- memorial ------------------------------------------------------------

  drawMemorial(ctx, body) {
    const guild = this.guild;
    const compact = this.compact;
    if (compact) {
      panel(ctx, body.x, body.y, body.w, body.h);
      const rows = [];
      for (const f of guild.fallen.slice().reverse()) rows.push({ kind: 'fallen', f });
      for (const line of guild.story.slice().reverse()) rows.push({ kind: 'story', line });
      const top = body.y + 30;
      const bottom = body.y + body.h - 6;
      text(ctx, 'THE WALL, AND THE LEDGER', body.x + 14, body.y + 20, { size: 9, color: COLORS.faint });
      if (!rows.length) {
        text(ctx, 'Nothing here yet. Give it time.', body.x + 14, top + 16, { size: 11, color: COLORS.dim });
        return;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(body.x, top - 2, body.w, bottom - top + 2);
      ctx.clip();
      let y = top - this.scroll.memorial;
      for (const row of rows) {
        if (row.kind === 'fallen') {
          const cls = CLASSES[row.f.classId] || {};
          if (y > top - 40 && y < bottom) {
            text(ctx, row.f.name, body.x + 14, y + 12, { size: 12, font: FONT_DISPLAY, color: '#c9a0a4' });
            text(ctx, `${cls.name || '?'} L${row.f.level} · fell in ${row.f.room}, ${row.f.depth} deep`,
              body.x + 14, y + 26, { size: 9, color: '#8a6066' });
          }
          y += 36;
        } else {
          const lines = wrap(ctx, row.line, body.w - 28, { size: 10 });
          if (y > top - 40 && y < bottom) {
            lines.forEach((l, i) => text(ctx, l, body.x + 14, y + 12 + i * 13, { size: 10, color: COLORS.dim }));
          }
          y += lines.length * 13 + 8;
        }
      }
      ctx.restore();
      this.scrollMax.memorial = Math.max(0, y + this.scroll.memorial - bottom);
      this.scroll.memorial = clamp(this.scroll.memorial, 0, this.scrollMax.memorial);
      this.drawScrollHint(ctx, body, 'memorial');
      return;
    }

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

  // --- sheets --------------------------------------------------------------

  drawSheet(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 5, 10, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Everything behind the sheet stops being clickable while it is up.
    this.rects = {};

    const pad = 10;
    const box = { x: pad, y: 52, w: W - pad * 2, h: H - 104 };
    panel(ctx, box.x, box.y, box.w, box.h, { fill: 'rgba(16, 14, 22, 0.99)', edge: COLORS.edgeBright, line: 2 });

    this.rects.closeSheet = { x: box.x + box.w - 74, y: box.y + box.h - 38, w: 64, h: 28 };

    if (this.sheet.kind === 'adventurer') {
      this.drawAdventurerDetail(ctx, { x: box.x, y: box.y, w: box.w, h: box.h - 40 }, true);
    } else {
      this.drawDeckList(ctx, { x: box.x, y: box.y, w: box.w, h: box.h - 40 }, true);
    }
    button(ctx, this.rects.closeSheet, 'Done', { hover: this.hover === 'closeSheet', size: 12 });
  }
}
