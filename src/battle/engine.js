// The turn-based battle engine.
//
// The engine is synchronous and produces a queue of typed events that the UI
// plays back one at a time. Nothing in here touches the DOM, so the whole
// thing runs under Node for the tests.

import { getSpecies } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { getItem } from '../data/items.js';
import { effectiveness, effectivenessMessage, stab } from '../data/types.js';
import { callAbility, abilityFlag } from '../data/abilities.js';
import { clamp } from '../core/util.js';
import { RNG } from '../core/rng.js';
import {
  STATUSES,
  VOLATILES,
  WEATHERS,
  TERRAINS,
  HAZARDS,
  SCREENS,
  stageMultiplier,
  accuracyStageMultiplier,
  critChanceForStage,
  STATUS_IMMUNE_TYPES,
} from './effects.js';
import {
  displayName,
  isFainted,
  expAward,
  gainExp,
  applyTrainingYield,
  addFriendship,
  attemptCapture,
  statusCaptureBonus,
} from '../systems/monster.js';

function freshBoosts() {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}

/** Per-battle scratch state attached to a creature when it enters. */
function initCombatState(mon, turn) {
  mon.boosts = freshBoosts();
  mon.volatiles = {};
  mon.flags = { enteredTurn: turn, lockedMove: null, protectStreak: 0 };
  mon.abilitySuppressed = false;
  return mon;
}

function clearCombatState(mon) {
  mon.boosts = freshBoosts();
  mon.volatiles = {};
  mon.flags = { enteredTurn: 0, lockedMove: null, protectStreak: 0 };
}

export class Battle {
  /**
   * @param {object} opts
   *   playerParty  array of mons (the player's team, index 0 leads)
   *   foeParty     array of mons
   *   isWild       true for wild encounters (catching + fleeing allowed)
   *   trainer      { name, title, prize, ai, dialogue } for trainer battles
   *   bag          the player's Bag instance (optional; enables item use)
   *   rng          seeded RNG
   *   environment  'cave' | 'grass' | ... — affects some capture orbs
   *   isNight      affects Dusk Orbs and evolution checks after battle
   */
  constructor(opts) {
    this.rng = opts.rng || new RNG(Date.now());
    this.isWild = !!opts.isWild;
    this.trainer = opts.trainer || null;
    this.bag = opts.bag || null;
    this.environment = opts.environment || 'grass';
    this.isNight = !!opts.isNight;
    this.playerName = opts.playerName || 'You';
    this.canFlee = opts.canFlee !== undefined ? opts.canFlee : this.isWild;
    this.canCatch = opts.canCatch !== undefined ? opts.canCatch : this.isWild;
    this.levelCap = opts.levelCap || null;

    this.sides = {
      player: {
        key: 'player',
        name: this.playerName,
        party: opts.playerParty,
        activeIndex: opts.playerParty.findIndex((m) => !isFainted(m)),
        hazards: {},
        screens: {},
        isPlayer: true,
      },
      foe: {
        key: 'foe',
        name: this.trainer ? this.trainer.name : 'Wild',
        party: opts.foeParty,
        activeIndex: 0,
        hazards: {},
        screens: {},
        isPlayer: false,
      },
    };
    if (this.sides.player.activeIndex < 0) this.sides.player.activeIndex = 0;

    this.turn = 0;
    this.events = [];
    this.state = 'start';
    this.outcome = null;
    this.lastCrit = false;
    this.weather = null;
    this.weatherTurns = 0;
    this.terrain = null;
    this.terrainTurns = 0;
    this.fleeAttempts = 0;
    this.pendingAction = null;
    this.participants = new Set();
    this.caught = null;
    this.moneyEarned = 0;
    this.expResults = [];
    this.awaitingSwitch = null;
  }

  // ── Event queue ──────────────────────────────────────────────────────────
  push(event) {
    this.events.push(event);
    return event;
  }

  log(text) {
    // Names like "the wild Nibbet" read oddly mid-sentence but need a capital
    // at the start of a line.
    const line = text.length ? text[0].toUpperCase() + text.slice(1) : text;
    return this.push({ t: 'text', text: line });
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ── Accessors ────────────────────────────────────────────────────────────
  active(sideKey) {
    const side = this.sides[sideKey];
    return side.party[side.activeIndex];
  }

  get playerMon() {
    return this.active('player');
  }

  get foeMon() {
    return this.active('foe');
  }

  sideOf(mon) {
    return this.sides.player.party.includes(mon) ? this.sides.player : this.sides.foe;
  }

  opponentOf(mon) {
    const side = this.sideOf(mon);
    return this.active(side.key === 'player' ? 'foe' : 'player');
  }

  name(mon) {
    const side = this.sideOf(mon);
    if (side.isPlayer) return displayName(mon);
    if (this.isWild) return `the wild ${displayName(mon)}`;
    return `${this.trainer ? this.trainer.name + "'s " : 'Foe '}${displayName(mon)}`;
  }

  /** Short name without articles, for compact UI lines. */
  shortName(mon) {
    return displayName(mon);
  }

  // ── Setup ────────────────────────────────────────────────────────────────
  start() {
    this.state = 'choosing';
    const foe = this.foeMon;
    const mine = this.playerMon;
    if (this.isWild) {
      this.log(`A wild ${displayName(foe)} appears!`);
    } else {
      this.log(`${this.trainer.title || 'Trainer'} ${this.trainer.name} wants to battle!`);
      if (this.trainer.dialogue && this.trainer.dialogue.intro) this.log(this.trainer.dialogue.intro);
      this.log(`${this.trainer.name} sends out ${displayName(foe)}!`);
    }
    this.push({ t: 'enter', side: 'foe', uid: foe.uid });
    initCombatState(foe, this.turn);

    this.log(`Go, ${displayName(mine)}!`);
    this.push({ t: 'enter', side: 'player', uid: mine.uid });
    initCombatState(mine, this.turn);
    this.participants.add(mine.uid);

    this.runSwitchIn(foe);
    this.runSwitchIn(mine);
    return this.drainEvents();
  }

  runSwitchIn(mon) {
    const side = this.sideOf(mon);
    this.applyHazards(mon, side);
    if (isFainted(mon)) return;
    callAbility(mon, 'onSwitchIn', { battle: this });
  }

  applyHazards(mon, side) {
    const types = getSpecies(mon.species).types;
    for (const key in side.hazards) {
      const layers = side.hazards[key];
      if (!layers) continue;
      const hazard = HAZARDS[key];
      if (hazard.status) {
        if (!STATUS_IMMUNE_TYPES[hazard.status] || !types.some((t) => STATUS_IMMUNE_TYPES[hazard.status].includes(t))) {
          this.log(hazard.message(this.name(mon)));
          this.applyStatus(mon, hazard.status, null, true);
        }
        continue;
      }
      const mult = hazard.typed ? effectiveness(hazard.typed, types) : 1;
      if (mult === 0) continue;
      const amount = Math.max(1, hazard.damage(mon, mult, layers));
      this.log(hazard.message(this.name(mon)));
      this.damage(mon, amount, 'hazard');
      if (isFainted(mon)) return;
    }
  }

  // ── Damage and healing ───────────────────────────────────────────────────
  damage(mon, amount, source = 'move') {
    if (amount <= 0 || isFainted(mon)) return 0;
    const before = mon.hp;
    mon.hp = clamp(mon.hp - Math.floor(amount), 0, mon.stats.hp);
    const dealt = before - mon.hp;
    this.push({
      t: 'damage',
      side: this.sideOf(mon).key,
      uid: mon.uid,
      amount: dealt,
      hp: mon.hp,
      max: mon.stats.hp,
      source,
    });
    return dealt;
  }

  heal(mon, amount, quiet = false) {
    if (isFainted(mon) || amount <= 0) return 0;
    let scaled = Math.floor(amount);
    if (mon.status === 'fray') scaled = Math.floor(scaled * STATUSES.fray.healPenalty);
    const before = mon.hp;
    mon.hp = clamp(mon.hp + scaled, 0, mon.stats.hp);
    const healed = mon.hp - before;
    if (healed > 0) {
      this.push({
        t: 'heal',
        side: this.sideOf(mon).key,
        uid: mon.uid,
        amount: healed,
        hp: mon.hp,
        max: mon.stats.hp,
      });
      if (!quiet) this.log(`${this.name(mon)} recovers health.`);
    }
    return healed;
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  /** Effective stat value including boosts, status, ability and held item. */
  statValue(mon, key) {
    let value = mon.stats[key];
    const foe = this.opponentOf(mon);
    const ignore = foe && !foe.abilitySuppressed && abilityFlag(foe, 'ignoreBoosts');
    if (!ignore) value = Math.floor(value * stageMultiplier(mon.boosts[key] || 0));

    if (key === 'spe' && mon.status === 'paralysis') value = Math.floor(value * STATUSES.paralysis.speedMult);
    if (key === 'atk' && mon.status === 'burn' && !abilityFlag(mon, 'guts')) value = Math.floor(value * 0.5);

    const held = mon.held ? getItem(mon.held) : null;
    if (held && held.hold) {
      if (held.hold.statMult && held.hold.statMult[key]) value = Math.floor(value * held.hold.statMult[key]);
      if (held.hold.unevolvedDefBoost && (key === 'def' || key === 'spd')) {
        const species = getSpecies(mon.species);
        if (species.evolutions.length) value = Math.floor(value * held.hold.unevolvedDefBoost);
      }
    }

    // Weather-based defensive bumps.
    if (this.weather === 'sand' && key === 'spd' && getSpecies(mon.species).types.includes('stone')) {
      value = Math.floor(value * 1.5);
    }

    const modded = callAbility(mon, 'onStatMod', { battle: this, stat: key, value });
    if (typeof modded === 'number') value = Math.floor(modded);
    return Math.max(1, value);
  }

  boostStat(mon, stat, delta, source = null) {
    if (isFainted(mon)) return false;
    if (delta < 0 && abilityFlag(mon, 'noStatDrops')) {
      this.log(`${this.name(mon)}'s stats cannot be lowered!`);
      return false;
    }
    if (delta < 0 && abilityFlag(mon, 'reflectStatDrops')) {
      const foe = this.opponentOf(mon);
      this.log(`${this.name(mon)}'s armour reflects it!`);
      if (foe) this.boostStat(foe, stat, delta);
      return false;
    }
    let applied = delta;
    if (abilityFlag(mon, 'invertBoosts')) applied = -applied;
    if (abilityFlag(mon, 'doubleBoosts')) applied *= 2;

    const before = mon.boosts[stat] || 0;
    const after = clamp(before + applied, -6, 6);
    mon.boosts[stat] = after;
    const change = after - before;
    if (change === 0) {
      this.log(`${this.name(mon)}'s ${statLabel(stat)} won't go ${applied > 0 ? 'higher' : 'lower'}!`);
      return false;
    }
    this.push({ t: 'boost', side: this.sideOf(mon).key, uid: mon.uid, stat, delta: change });
    const word =
      Math.abs(change) >= 3 ? 'drastically' : Math.abs(change) === 2 ? 'sharply' : '';
    const dir = change > 0 ? 'rose' : 'fell';
    this.log(
      `${this.name(mon)}'s ${statLabel(stat)} ${word ? word + ' ' : ''}${dir}${source ? ' from ' + source : ''}!`
    );
    return true;
  }

  resetBoosts() {
    for (const key of ['player', 'foe']) {
      const mon = this.active(key);
      if (mon) mon.boosts = freshBoosts();
    }
    this.log('All stat changes are wiped away!');
  }

  // ── Status ───────────────────────────────────────────────────────────────
  applyStatus(mon, status, source = null, silentFail = false) {
    if (isFainted(mon) || !STATUSES[status]) return false;
    const side = this.sideOf(mon);
    if (mon.status) {
      if (!silentFail) this.log(`${this.name(mon)} is already ${STATUSES[mon.status].name}.`);
      return false;
    }
    const types = getSpecies(mon.species).types;
    const immuneTypes = STATUS_IMMUNE_TYPES[status];
    if (immuneTypes && types.some((t) => immuneTypes.includes(t))) {
      if (!silentFail) this.log(`${this.name(mon)} is immune to that.`);
      return false;
    }
    if (side.screens.sanctuary) {
      if (!silentFail) this.log(`Sanctuary protects ${this.name(mon)}!`);
      return false;
    }
    const held = mon.held ? getItem(mon.held) : null;
    if (held && held.hold && held.hold.noStatus && status !== 'confusion') {
      // Padded Vest only blocks the holder's own status moves, not conditions.
    }
    const allowed = callAbility(mon, 'onStatusAttempt', { battle: this, status, source });
    if (allowed === false) return false;

    mon.status = status;
    mon.statusTurns = 0;
    const def = STATUSES[status];
    if (def.duration) mon.statusTurns = this.rng.int(def.duration[0], def.duration[1]);
    this.push({ t: 'status', side: side.key, uid: mon.uid, status });
    this.log(def.message(this.name(mon)));

    // Clear Berry-style held items react immediately.
    if (held && held.hold && held.hold.cureStatus) {
      this.log(`${this.name(mon)}'s ${held.name} clears it!`);
      this.consumeHeld(mon);
      this.cureStatus(mon, null, true);
    }
    return true;
  }

  cureStatus(mon, reason = null, quiet = false) {
    if (!mon.status) return false;
    const was = mon.status;
    mon.status = null;
    mon.statusTurns = 0;
    this.push({ t: 'status', side: this.sideOf(mon).key, uid: mon.uid, status: null });
    if (!quiet) {
      this.log(reason ? `${this.name(mon)} ${reason}!` : `${this.name(mon)} is no longer ${STATUSES[was].name}.`);
    }
    return true;
  }

  addVolatile(mon, key, turns = null) {
    if (isFainted(mon)) return false;
    const def = VOLATILES[key];
    if (!def) return false;
    if (mon.volatiles[key]) return false;
    let duration = turns;
    if (duration === null && def.duration) duration = this.rng.int(def.duration[0], def.duration[1]);
    mon.volatiles[key] = { turns: duration === null ? 999 : duration };
    return true;
  }

  removeVolatile(mon, key) {
    delete mon.volatiles[key];
  }

  consumeHeld(mon) {
    const item = mon.held ? getItem(mon.held) : null;
    if (item && item.consumable) mon.held = null;
  }

  // ── Weather and terrain ──────────────────────────────────────────────────
  setWeather(kind, turns, source = null) {
    if (this.weather === kind) {
      this.weatherTurns = Math.max(this.weatherTurns, turns);
      return false;
    }
    this.weather = kind;
    this.weatherTurns = turns;
    this.push({ t: 'weather', weather: kind });
    this.log(WEATHERS[kind].start);
    return true;
  }

  setTerrain(kind, turns) {
    this.terrain = kind;
    this.terrainTurns = turns;
    this.push({ t: 'terrain', terrain: kind });
    this.log(TERRAINS[kind].start);
    return true;
  }

  setScreen(side, kind) {
    if (side.screens[kind]) {
      this.log('It failed!');
      return false;
    }
    side.screens[kind] = SCREENS[kind].turns;
    this.log(SCREENS[kind].start);
    return true;
  }

  setHazard(side, kind) {
    const hazard = HAZARDS[kind];
    const current = side.hazards[kind] || 0;
    if (current >= hazard.maxLayers) {
      this.log('It failed!');
      return false;
    }
    side.hazards[kind] = current + 1;
    this.log(hazard.start);
    return true;
  }

  // ── Action entry points ──────────────────────────────────────────────────
  /** Records the player's action for this turn. */
  setPlayerAction(action) {
    this.pendingAction = action;
  }

  /** Legal move indices for the active creature (PP > 0, not locked out). */
  availableMoves(mon) {
    const held = mon.held ? getItem(mon.held) : null;
    const locked = held && held.hold && held.hold.lockMove ? mon.flags.lockedMove : null;
    return mon.moves
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => {
        if (slot.pp <= 0) return false;
        if (locked && slot.id !== locked) return false;
        const move = getMove(slot.id);
        if (mon.volatiles.taunt && move.category === 'status') return false;
        if (held && held.hold && held.hold.noStatus && move.category === 'status') return false;
        return true;
      });
  }

  /**
   * Runs one full turn. The player action must already be set.
   * @returns {Array} the event queue for the UI to play back
   */
  runTurn() {
    if (this.state === 'ended') return this.drainEvents();
    this.turn++;
    const playerAction = this.pendingAction || { type: 'struggle' };
    this.pendingAction = null;
    const foeAction = this.chooseFoeAction();

    const actions = [
      { side: 'player', mon: this.playerMon, action: playerAction },
      { side: 'foe', mon: this.foeMon, action: foeAction },
    ];

    for (const entry of actions) entry.order = this.actionPriority(entry);
    actions.sort((a, b) => {
      if (b.order !== a.order) return b.order - a.order;
      const sa = this.statValue(a.mon, 'spe');
      const sb = this.statValue(b.mon, 'spe');
      if (sb !== sa) {
        const quickA = this.quickClawRoll(a.mon);
        const quickB = this.quickClawRoll(b.mon);
        if (quickA && !quickB) return -1;
        if (quickB && !quickA) return 1;
        return sb - sa;
      }
      return this.rng.chance(0.5) ? -1 : 1;
    });

    for (const entry of actions) {
      if (this.state === 'ended') break;
      if (isFainted(entry.mon)) continue;
      // A creature that was swapped out mid-turn no longer acts.
      if (this.active(entry.side) !== entry.mon && entry.action.type === 'move') continue;
      this.executeAction(entry.side, entry.action, entry.mon);
      this.checkFaints();
      if (this.state === 'ended') break;
    }

    if (this.state !== 'ended') {
      this.endOfTurn();
      this.checkFaints();
    }
    if (this.state !== 'ended' && !this.awaitingSwitch) this.state = 'choosing';
    return this.drainEvents();
  }

  quickClawRoll(mon) {
    const held = mon.held ? getItem(mon.held) : null;
    if (held && held.hold && held.hold.quickChance) return this.rng.chance(held.hold.quickChance);
    return false;
  }

  actionPriority({ mon, action }) {
    if (action.type === 'item' || action.type === 'switch' || action.type === 'run') return 6;
    if (action.type !== 'move') return 0;
    const move = getMove(mon.moves[action.index].id);
    let priority = move.priority;
    const modded = callAbility(mon, 'onModifyPriority', { battle: this, user: mon, move, priority });
    if (typeof modded === 'number') priority = modded;
    return priority;
  }

  executeAction(sideKey, action, mon) {
    switch (action.type) {
      case 'move':
        this.useMove(mon, action.index);
        break;
      case 'switch':
        this.switchIn(sideKey, action.index);
        break;
      case 'item':
        this.useItem(sideKey, action);
        break;
      case 'run':
        this.attemptRun();
        break;
      case 'struggle':
        this.struggle(mon);
        break;
      default:
        break;
    }
  }

  // ── Switching ────────────────────────────────────────────────────────────
  switchIn(sideKey, index, { silent = false } = {}) {
    const side = this.sides[sideKey];
    const outgoing = side.party[side.activeIndex];
    const incoming = side.party[index];
    if (!incoming || isFainted(incoming) || incoming === outgoing) return false;

    if (outgoing && !isFainted(outgoing)) {
      if (abilityFlag(outgoing, 'regenOnSwitch')) {
        this.heal(outgoing, Math.floor(outgoing.stats.hp / 3), true);
      }
      if (abilityFlag(outgoing, 'cureOnSwitch') && outgoing.status) {
        outgoing.status = null;
        outgoing.statusTurns = 0;
      }
      if (!silent) this.log(`${side.isPlayer ? 'Come back' : 'Enough'}, ${displayName(outgoing)}!`);
      clearCombatState(outgoing);
    }

    side.activeIndex = index;
    initCombatState(incoming, this.turn);
    this.push({ t: 'enter', side: sideKey, uid: incoming.uid });
    this.log(
      side.isPlayer ? `Go, ${displayName(incoming)}!` : `${side.name} sends out ${displayName(incoming)}!`
    );
    if (side.isPlayer) this.participants.add(incoming.uid);
    this.runSwitchIn(incoming);
    if (this.awaitingSwitch === sideKey) {
      // The forced switch is satisfied; hand control back to the turn loop.
      this.awaitingSwitch = null;
      if (this.state !== 'ended') this.state = 'choosing';
    }
    this.checkFaints();
    return true;
  }

  /** Party indices that can legally be sent out. */
  switchableIndices(sideKey) {
    const side = this.sides[sideKey];
    return side.party
      .map((mon, index) => ({ mon, index }))
      .filter(({ mon, index }) => !isFainted(mon) && index !== side.activeIndex)
      .map(({ index }) => index);
  }

  // ── Items in battle ──────────────────────────────────────────────────────
  useItem(sideKey, action) {
    const side = this.sides[sideKey];
    const item = getItem(action.itemId);
    if (!item) return;
    if (side.isPlayer && this.bag && !this.bag.has(action.itemId)) return;

    this.log(`${side.isPlayer ? this.playerName : side.name} used the ${item.name}.`);
    const effect = item.effect || {};

    if (effect.capture !== undefined) {
      this.throwOrb(action.itemId, item);
      if (side.isPlayer && this.bag) this.bag.remove(action.itemId, 1);
      return;
    }

    const target =
      item.target === 'self' || action.targetIndex === undefined
        ? this.active(sideKey)
        : side.party[action.targetIndex];

    this.applyItemEffect(target, item, sideKey);
    if (side.isPlayer && this.bag && item.consumable) this.bag.remove(action.itemId, 1);
  }

  applyItemEffect(target, item, sideKey) {
    const effect = item.effect || {};
    if (effect.heal !== undefined && !isFainted(target)) {
      const amount = effect.heal === 'full' ? target.stats.hp : effect.heal;
      const healed = this.heal(target, amount, true);
      this.log(`${displayName(target)} recovered ${healed} HP.`);
    }
    if (effect.revive && isFainted(target)) {
      target.hp = Math.max(1, Math.floor(target.stats.hp * effect.revive));
      target.status = null;
      this.push({ t: 'heal', side: sideKey, uid: target.uid, amount: target.hp, hp: target.hp, max: target.stats.hp });
      this.log(`${displayName(target)} is back on its feet!`);
    }
    if (effect.cure) {
      if (effect.cure === 'all' || (Array.isArray(effect.cure) && effect.cure.includes(target.status))) {
        if (target.status) this.cureStatus(target, 'feels better');
      }
      if (effect.cure === 'all' || (Array.isArray(effect.cure) && effect.cure.includes('confusion'))) {
        if (target.volatiles && target.volatiles.confusion) {
          this.removeVolatile(target, 'confusion');
          this.log(`${displayName(target)} snaps out of its confusion.`);
        }
      }
    }
    if (effect.boost) {
      for (const stat in effect.boost) this.boostStat(target, stat, effect.boost[stat]);
    }
    if (effect.screen) this.setScreen(this.sides[sideKey], effect.screen);
    if (effect.pp !== undefined) {
      const slot = target.moves.find((m) => m.pp < m.maxPp);
      if (slot) {
        slot.pp = effect.pp === 'full' ? slot.maxPp : Math.min(slot.maxPp, slot.pp + effect.pp);
        this.log(`${displayName(target)}'s ${getMove(slot.id).name} regained PP.`);
      }
    }
    if (effect.ppAll !== undefined) {
      for (const slot of target.moves) slot.pp = Math.min(slot.maxPp, slot.pp + effect.ppAll);
      this.log(`${displayName(target)}'s moves regained PP.`);
    }
    if (effect.flee) {
      this.log('You slip away in the smoke!');
      this.finish('fled');
    }
  }

  // ── Capture ──────────────────────────────────────────────────────────────
  throwOrb(itemId, item) {
    if (!this.canCatch) {
      this.log(this.trainer ? "You can't catch another trainer's creature!" : "It won't work here.");
      return;
    }
    const target = this.foeMon;
    let multiplier = item.effect.capture;
    if (item.effect.capture_night && this.isNight) multiplier = item.effect.capture_night;
    if (item.effect.capture_cave && this.environment === 'cave') {
      multiplier = Math.max(multiplier, item.effect.capture_cave);
    }
    if (item.effect.capture_types) {
      const types = getSpecies(target.species).types;
      for (const t of types) {
        if (item.effect.capture_types[t]) multiplier = Math.max(multiplier, item.effect.capture_types[t]);
      }
    }
    if (item.effect.capture_turnScaling) {
      multiplier = Math.min(4, multiplier + this.turn * item.effect.capture_turnScaling);
    }
    const abilityMod = callAbility(this.playerMon, 'onCapture', { battle: this, rate: multiplier });
    if (typeof abilityMod === 'number') multiplier = abilityMod;

    const result = attemptCapture(target, multiplier, this.rng, {
      statusBonus: statusCaptureBonus(target),
      turn: this.turn,
    });
    this.push({ t: 'throw', item: itemId, shakes: result.shakes, caught: result.caught });
    for (let i = 0; i < result.shakes && i < 3; i++) this.log('...');
    if (result.caught) {
      this.log(`Gotcha! ${displayName(target)} was caught!`);
      if (item.effect.healOnCatch) {
        target.hp = target.stats.hp;
        target.status = null;
      }
      if (item.effect.friendshipBonus) addFriendship(target, item.effect.friendshipBonus);
      this.caught = target;
      this.finish('caught');
    } else {
      const flavour = [
        'Oh! It broke free at the last moment!',
        'Aargh! Almost had it!',
        'So close! It got out!',
        'It escaped the orb!',
      ];
      this.log(flavour[Math.min(result.shakes, flavour.length - 1)]);
    }
  }

  // ── Running ──────────────────────────────────────────────────────────────
  attemptRun() {
    if (!this.canFlee) {
      this.log("There's no running from this battle!");
      return;
    }
    const mine = this.playerMon;
    const foe = this.foeMon;
    if (mine.volatiles.trap) {
      this.log(`${displayName(mine)} can't escape!`);
      return;
    }
    this.fleeAttempts++;
    const mySpeed = this.statValue(mine, 'spe');
    const foeSpeed = this.statValue(foe, 'spe');
    const odds =
      mySpeed >= foeSpeed ? 1 : ((mySpeed * 128) / Math.max(1, foeSpeed) + 30 * this.fleeAttempts) / 256;
    if (this.rng.next() < odds) {
      this.log('Got away safely!');
      this.finish('fled');
    } else {
      this.log("Couldn't get away!");
    }
  }

  // ── Using a move ─────────────────────────────────────────────────────────
  useMove(user, moveIndex) {
    const slot = user.moves[moveIndex];
    if (!slot) return this.struggle(user);
    const move = getMove(slot.id);
    const target = this.opponentOf(user);

    // Pre-move status checks.
    if (!this.canAct(user, move)) return;

    if (user.volatiles.charging) {
      this.removeVolatile(user, 'charging');
    } else if (move.effect && move.effect.chargeUnless && this.weather !== move.effect.chargeUnless) {
      this.addVolatile(user, 'charging', 1);
      this.log(`${this.name(user)} gathers light!`);
      return;
    }

    slot.pp = Math.max(0, slot.pp - 1);
    const held = user.held ? getItem(user.held) : null;
    if (held && held.hold && held.hold.lockMove && !user.flags.lockedMove) {
      user.flags.lockedMove = slot.id;
    }

    this.push({ t: 'move', side: this.sideOf(user).key, uid: user.uid, move: move.id });
    this.log(`${this.name(user)} used ${move.name}!`);

    if (!target || isFainted(target)) {
      this.log('But there was no target...');
      return;
    }

    // Protect.
    if (target.volatiles.protect && !(move.effect && move.effect.breakProtect)) {
      this.log(`${this.name(target)} protects itself!`);
      return;
    }

    if (move.category === 'status') {
      if (!this.accuracyCheck(user, target, move)) return;
      this.applyMoveEffect(user, target, move, 0);
      return;
    }

    // Absorbing abilities.
    const absorbed = callAbility(target, 'onTryHitImmunity', { battle: this, user, target, move });
    if (absorbed) return;

    const types = getSpecies(target.species).types;
    let eff = effectiveness(move.type, types);
    if (move.effect && move.effect.ignoreImmunity && eff === 0) eff = 1;
    const scrapper = abilityFlag(user, 'ignoresImmunity');
    if (eff === 0 && scrapper && types.includes(scrapper)) eff = 1;
    if (eff === 0) {
      this.log(`It has no effect on ${this.name(target)}...`);
      return;
    }

    if (!this.accuracyCheck(user, target, move)) return;

    const hits = this.hitCount(move);
    let totalDamage = 0;
    let lastEff = eff;
    for (let i = 0; i < hits; i++) {
      if (isFainted(target)) break;
      const result = this.dealMoveDamage(user, target, move, eff);
      totalDamage += result.damage;
      lastEff = result.effectiveness;
    }
    if (hits > 1) this.log(`Hit ${hits} time${hits > 1 ? 's' : ''}!`);

    const message = effectivenessMessage(lastEff);
    if (message) this.log(message);

    if (!isFainted(target)) {
      callAbility(target, 'onAfterDamage', { battle: this, user, target, move, damage: totalDamage });
    }

    if (totalDamage > 0) this.applyMoveEffect(user, target, move, totalDamage);

    // Held item recoil (Reckless Charm).
    const userHeld = user.held ? getItem(user.held) : null;
    if (userHeld && userHeld.hold && userHeld.hold.recoil && totalDamage > 0) {
      this.damage(user, Math.max(1, Math.floor(user.stats.hp * userHeld.hold.recoil)), 'item');
      this.log(`${this.name(user)} is worn down by its ${userHeld.name}.`);
    }
  }

  struggle(user) {
    const target = this.opponentOf(user);
    this.log(`${this.name(user)} has no moves left and struggles!`);
    if (!target) return;
    const damage = Math.max(1, Math.floor(target.stats.hp / 6));
    this.damage(target, damage, 'struggle');
    this.damage(user, Math.max(1, Math.floor(user.stats.hp / 4)), 'recoil');
    this.log(`${this.name(user)} is hurt by the strain.`);
  }

  canAct(user, move) {
    // Flinch.
    if (user.volatiles.flinch) {
      this.removeVolatile(user, 'flinch');
      this.log(`${this.name(user)} flinched!`);
      return false;
    }
    if (user.volatiles.recharge) {
      this.removeVolatile(user, 'recharge');
      this.log(`${this.name(user)} must recharge!`);
      return false;
    }
    if (user.status === 'sleep') {
      if (user.statusTurns <= 0) {
        this.cureStatus(user, 'wakes up');
      } else {
        user.statusTurns--;
        this.log(STATUSES.sleep.tick(this.name(user)));
        return false;
      }
    }
    if (user.status === 'freeze') {
      const thaws = move.type === 'ember' || this.rng.percent(STATUSES.freeze.thawChance);
      if (thaws) this.cureStatus(user, 'thaws out');
      else {
        this.log(STATUSES.freeze.tick(this.name(user)));
        return false;
      }
    }
    if (user.status === 'paralysis' && this.rng.percent(STATUSES.paralysis.skipChance)) {
      this.log(`${this.name(user)} is paralysed and can't move!`);
      return false;
    }
    if (user.volatiles.confusion) {
      const state = user.volatiles.confusion;
      if (state.turns <= 0) {
        this.removeVolatile(user, 'confusion');
        this.log(`${this.name(user)} snaps out of its confusion.`);
      } else {
        state.turns--;
        this.log(`${this.name(user)} is confused!`);
        if (this.rng.percent(VOLATILES.confusion.selfHitChance)) {
          const damage = this.rawDamage(user, user, { power: 40, category: 'physical', type: 'none' }, 1, false);
          this.damage(user, damage, 'confusion');
          this.log(`It hurt itself in its confusion!`);
          return false;
        }
      }
    }
    return true;
  }

  accuracyCheck(user, target, move) {
    if (move.accuracy === 0) return true;
    let accuracy = move.accuracy;
    if (move.effect && move.effect.rainPerfect && this.weather === 'rain') return true;
    const modded = callAbility(user, 'onModifyAccuracy', { battle: this, user, target, move, accuracy });
    if (typeof modded === 'number') accuracy = modded;
    const targetMod = callAbility(target, 'onModifyAccuracy', { battle: this, user, target, move, accuracy });
    if (typeof targetMod === 'number') accuracy = Math.min(accuracy, targetMod);

    const evasionAura = abilityFlag(target, 'evasionAura');
    if (evasionAura) accuracy *= evasionAura;

    const stages = (user.boosts.acc || 0) - (target.boosts.eva || 0);
    accuracy *= accuracyStageMultiplier(clamp(stages, -6, 6));

    if (this.rng.next() * 100 < accuracy) return true;
    this.log(`${this.name(user)}'s attack missed!`);
    return false;
  }

  hitCount(move) {
    if (!move.effect || !move.effect.multiHit) return 1;
    const [min, max] = move.effect.multiHit;
    // Classic distribution: 2 and 3 hits are the common outcomes.
    const roll = this.rng.int(1, 8);
    if (roll <= 3) return min;
    if (roll <= 6) return Math.min(max, min + 1);
    return max;
  }

  dealMoveDamage(user, target, move, eff) {
    const crit = this.critCheck(user, move);
    this.lastCrit = crit;
    let damage = this.rawDamage(user, target, move, eff, crit);

    // Ability and item multipliers.
    let mult = 1;
    const dealt = callAbility(user, 'onModifyDamageDealt', {
      battle: this, user, target, move, mult, effectiveness: eff,
    });
    if (typeof dealt === 'number') mult = dealt;
    const taken = callAbility(target, 'onModifyDamageTaken', {
      battle: this, user, target, move, mult: 1, effectiveness: eff,
    });
    if (typeof taken === 'number') mult *= taken;

    const held = user.held ? getItem(user.held) : null;
    if (held && held.hold) {
      if (held.hold.damageMult) mult *= held.hold.damageMult;
      if (held.hold.typeBoost === move.type) mult *= held.hold.typeMult;
    }

    damage = Math.max(1, Math.floor(damage * mult));

    // Sturdy / Last Knot survive a knockout from full health.
    const targetHeld = target.held ? getItem(target.held) : null;
    const survives =
      (abilityFlag(target, 'endures') || (targetHeld && targetHeld.hold && targetHeld.hold.survive)) &&
      target.hp === target.stats.hp &&
      damage >= target.hp;
    if (survives) {
      damage = target.hp - 1;
      this.damage(target, damage, 'move');
      this.log(`${this.name(target)} hung on!`);
      if (targetHeld && targetHeld.hold && targetHeld.hold.survive) this.consumeHeld(target);
      if (crit) this.log('A critical hit!');
      return { damage, effectiveness: eff };
    }

    if (crit) this.log('A critical hit!');
    const applied = this.damage(target, damage, 'move');

    // Pinch berries.
    if (targetHeld && targetHeld.hold && targetHeld.hold.pinchHeal && target.hp > 0) {
      if (target.hp <= target.stats.hp / 4) {
        this.log(`${this.name(target)} eats its ${targetHeld.name}!`);
        this.heal(target, Math.floor(target.stats.hp * targetHeld.hold.pinchHeal), true);
        this.consumeHeld(target);
      }
    }
    return { damage: applied, effectiveness: eff };
  }

  critCheck(user, move) {
    let stage = 0;
    if (move.effect && move.effect.critStage) stage += move.effect.critStage;
    const modded = callAbility(user, 'onModifyCritStage', { battle: this, user, move, stage });
    if (typeof modded === 'number') stage = modded;
    return this.rng.next() < critChanceForStage(clamp(stage, 0, 4));
  }

  /** The core damage formula, before ability/item multipliers. */
  rawDamage(user, target, move, eff, crit) {
    const category = move.category;
    let power = move.power;
    if (move.effect) {
      if (move.effect.doubleIfHurt && target.hp <= target.stats.hp / 2) power *= 2;
      if (move.effect.doubleIfStatus && target.status) power *= 2;
    }
    const powerMod = callAbility(user, 'onModifyAttack', { battle: this, user, target, move, power });
    if (typeof powerMod === 'number') power = powerMod;

    const attackStat = category === 'physical' ? 'atk' : 'spa';
    const defenseStat = category === 'physical' ? 'def' : 'spd';
    let attack = this.statValue(user, attackStat);
    let defense = this.statValue(target, defenseStat);
    // A critical hit ignores the target's positive defensive boosts.
    if (crit && (target.boosts[defenseStat] || 0) > 0) defense = target.stats[defenseStat];

    let damage = Math.floor(
      Math.floor((Math.floor((2 * user.level) / 5 + 2) * power * attack) / Math.max(1, defense)) / 50
    ) + 2;

    if (crit) damage = Math.floor(damage * 1.5);

    // Same-type attack bonus.
    const stabBonus = abilityFlag(user, 'stabBonus');
    const userTypes = getSpecies(user.species).types;
    if (userTypes.includes(move.type)) damage = Math.floor(damage * (stabBonus === 2 ? 2 : 1.5));

    damage = Math.floor(damage * eff);

    // Weather.
    if (this.weather && WEATHERS[this.weather].boost && WEATHERS[this.weather].boost[move.type]) {
      damage = Math.floor(damage * WEATHERS[this.weather].boost[move.type]);
    }
    if (this.terrain && TERRAINS[this.terrain].boost && TERRAINS[this.terrain].boost[move.type]) {
      damage = Math.floor(damage * TERRAINS[this.terrain].boost[move.type]);
    }

    // Screens.
    const targetSide = this.sideOf(target);
    if (!crit) {
      if (category === 'physical' && targetSide.screens.reflect) damage = Math.floor(damage * 0.5);
      if (category === 'special' && targetSide.screens.lightscreen) damage = Math.floor(damage * 0.5);
    }

    // Damage roll.
    damage = Math.floor((damage * this.rng.int(85, 100)) / 100);
    return Math.max(1, damage);
  }

  /** Everything a move does after (or instead of) its damage. */
  applyMoveEffect(user, target, move, damage) {
    const e = move.effect;
    if (!e) return;
    const chance = e.chance !== undefined ? e.chance : 100;
    const rollPassed = this.rng.percent(chance);

    if (e.status && rollPassed) {
      const victim = move.category === 'status' || move.target === 'foe' ? target : target;
      if (e.status === 'confusion') this.addVolatile(victim, 'confusion');
      else this.applyStatus(victim, e.status, user);
    }
    if (e.flinch !== undefined && this.rng.percent(e.flinch) && damage > 0) {
      this.addVolatile(target, 'flinch', 1);
    }
    if (e.boost && rollPassed) {
      const victim = e.target === 'foe' ? target : e.target === 'self' ? user : move.target === 'foe' ? target : user;
      for (const stat in e.boost) this.boostStat(victim, stat, e.boost[stat]);
    }
    if (e.selfBoost) {
      for (const stat in e.selfBoost) this.boostStat(user, stat, e.selfBoost[stat]);
    }
    if (e.drain && damage > 0) {
      const healed = this.heal(user, Math.max(1, Math.floor(damage * e.drain)), true);
      if (healed) this.log(`${this.name(user)} drains health from ${this.name(target)}!`);
    }
    if (e.recoil && damage > 0) {
      this.damage(user, Math.max(1, Math.floor(damage * e.recoil)), 'recoil');
      this.log(`${this.name(user)} is hit by the recoil!`);
    }
    if (e.heal) {
      const healed = this.heal(user, Math.floor(user.stats.hp * e.heal), true);
      this.log(healed ? `${this.name(user)} restored its health.` : 'But nothing happened.');
    }
    if (e.cureStatus && user.status) this.cureStatus(user, 'clears itself');
    if (e.cureParty) {
      const side = this.sideOf(user);
      for (const mon of side.party) {
        if (mon.status) {
          mon.status = null;
          mon.statusTurns = 0;
        }
      }
      this.log('A clean light washes over the party.');
    }
    if (e.rest) {
      if (user.hp === user.stats.hp) {
        this.log('But it is already at full health.');
      } else {
        user.status = 'sleep';
        user.statusTurns = 2;
        this.heal(user, user.stats.hp, true);
        this.push({ t: 'status', side: this.sideOf(user).key, uid: user.uid, status: 'sleep' });
        this.log(`${this.name(user)} sleeps and wakes up healthy!`);
      }
    }
    if (e.protect) {
      const streak = user.flags.protectStreak || 0;
      if (streak > 0 && this.rng.next() < 1 - 1 / (streak + 1)) {
        this.log('But it failed!');
        user.flags.protectStreak = 0;
      } else {
        this.addVolatile(user, 'protect', 1);
        user.flags.protectStreak = streak + 1;
        this.log(`${this.name(user)} braces itself!`);
      }
    }
    if (e.weather) this.setWeather(e.weather, 5, user);
    if (e.hazard) this.setHazard(this.sideOf(target), e.hazard);
    if (e.screen) this.setScreen(this.sideOf(user), e.screen);
    if (e.seed) {
      if (target.volatiles.seed) this.log('It failed!');
      else {
        this.addVolatile(target, 'seed');
        this.log(`${this.name(target)} is seeded!`);
      }
    }
    if (e.trap) {
      if (this.addVolatile(target, 'trap', typeof e.trap === 'number' ? e.trap : 4)) {
        this.log(`${this.name(target)} can no longer escape!`);
      }
    }
    if (e.taunt) {
      if (this.addVolatile(target, 'taunt', e.taunt)) this.log(`${this.name(target)} is goaded into attacking!`);
    }
    if (e.resetBoosts) this.resetBoosts();
    if (e.steal && !user.held && target.held) {
      const stolen = getItem(target.held);
      user.held = target.held;
      target.held = null;
      this.log(`${this.name(user)} stole the ${stolen.name}!`);
    }
    if (e.forceSwitch) {
      if (this.isWild) {
        this.log('The wild creature is blown away!');
        this.finish('fled');
      } else {
        const options = this.switchableIndices(this.sideOf(target).key);
        if (options.length) {
          this.switchIn(this.sideOf(target).key, this.rng.pick(options), { silent: true });
        } else {
          this.log('But it failed!');
        }
      }
    }
    if (e.fleeField) {
      if (this.isWild) {
        this.log('You slip away!');
        this.finish('fled');
      } else {
        this.log('But it failed!');
      }
    }
    if (e.sunDouble && this.weather === 'sun' && e.boost) {
      for (const stat in e.boost) this.boostStat(user, stat, e.boost[stat]);
    }
  }

  // ── End of turn ──────────────────────────────────────────────────────────
  endOfTurn() {
    const order = [this.playerMon, this.foeMon].sort(
      (a, b) => this.statValue(b, 'spe') - this.statValue(a, 'spe')
    );

    // Weather chip damage.
    if (this.weather) {
      const w = WEATHERS[this.weather];
      if (w.ongoing) this.log(w.ongoing);
      if (w.chip) {
        for (const mon of order) {
          if (isFainted(mon)) continue;
          const types = getSpecies(mon.species).types;
          if (types.some((t) => w.chipImmune.includes(t))) continue;
          if (abilityFlag(mon, 'weatherProof')) continue;
          this.damage(mon, Math.max(1, Math.floor(mon.stats.hp * w.chip)), 'weather');
          this.log(`${this.name(mon)} is buffeted by the ${w.name.toLowerCase()}.`);
        }
      }
      this.weatherTurns--;
      if (this.weatherTurns <= 0) {
        this.log(w.end);
        this.weather = null;
        this.push({ t: 'weather', weather: null });
      }
    }

    if (this.terrain) {
      const t = TERRAINS[this.terrain];
      if (t.chip) {
        for (const mon of order) {
          if (isFainted(mon)) continue;
          this.damage(mon, Math.max(1, Math.floor(mon.stats.hp * t.chip)), 'terrain');
        }
        this.log('The frayed Weave pulls at everything on the field.');
      }
      this.terrainTurns--;
      if (this.terrainTurns <= 0) {
        this.log(t.end);
        this.terrain = null;
        this.push({ t: 'terrain', terrain: null });
      }
    }

    for (const mon of order) {
      if (isFainted(mon)) continue;

      // Status residuals.
      if (mon.status && STATUSES[mon.status].residual) {
        const def = STATUSES[mon.status];
        if (mon.status === 'poison' && abilityFlag(mon, 'poisonHeals')) {
          this.heal(mon, Math.floor(mon.stats.hp / 8), true);
          this.log(`${this.name(mon)} is nourished by the poison.`);
        } else {
          mon.statusTurns++;
          const scale = def.escalating ? mon.statusTurns : 1;
          const amount = Math.max(1, Math.floor(mon.stats.hp * def.residual * scale));
          this.damage(mon, amount, 'status');
          this.log(def.tick(this.name(mon)));
        }
      }

      // Trap damage.
      if (mon.volatiles.trap) {
        const state = mon.volatiles.trap;
        this.damage(mon, Math.max(1, Math.floor(mon.stats.hp * VOLATILES.trap.residual)), 'trap');
        this.log(`${this.name(mon)} is caught in the vortex!`);
        state.turns--;
        if (state.turns <= 0) {
          this.removeVolatile(mon, 'trap');
          this.log(`${this.name(mon)} breaks free!`);
        }
      }

      // Leech Seed.
      if (mon.volatiles.seed) {
        const drainer = this.opponentOf(mon);
        const amount = Math.max(1, Math.floor(mon.stats.hp * VOLATILES.seed.drain));
        this.damage(mon, amount, 'seed');
        this.log(`${this.name(mon)}'s health is sapped by the seed!`);
        if (drainer && !isFainted(drainer)) this.heal(drainer, amount, true);
      }

      // Held item ticks.
      const held = mon.held ? getItem(mon.held) : null;
      if (held && held.hold && held.hold.endTurnHeal && mon.hp < mon.stats.hp) {
        this.heal(mon, Math.max(1, Math.floor(mon.stats.hp * held.hold.endTurnHeal)), true);
        this.log(`${this.name(mon)} nibbles its ${held.name}.`);
      }

      callAbility(mon, 'onEndTurn', { battle: this });

      // Countdown volatiles.
      for (const key of ['taunt', 'protect']) {
        if (mon.volatiles[key]) {
          mon.volatiles[key].turns--;
          if (mon.volatiles[key].turns <= 0) {
            this.removeVolatile(mon, key);
            if (key === 'taunt') this.log(`${this.name(mon)} shakes off the taunt.`);
          }
        }
      }
      if (!mon.volatiles.protect) mon.flags.protectStreak = mon.flags.protectStreak || 0;
    }

    // Screen countdowns.
    for (const key of ['player', 'foe']) {
      const side = this.sides[key];
      for (const screen in side.screens) {
        side.screens[screen]--;
        if (side.screens[screen] <= 0) {
          delete side.screens[screen];
          this.log(SCREENS[screen].end);
        }
      }
    }
  }

  // ── Faints, rewards and the end of the battle ────────────────────────────
  checkFaints() {
    for (const key of ['player', 'foe']) {
      const mon = this.active(key);
      if (!mon || !isFainted(mon) || mon.flags.fainted) continue;
      mon.flags.fainted = true;
      this.push({ t: 'faint', side: key, uid: mon.uid });
      this.log(`${this.name(mon)} fainted!`);
      const killer = this.opponentOf(mon);
      callAbility(mon, 'onFaint', { battle: this, source: killer });

      if (key === 'foe') {
        this.awardSpoils(mon);
        if (killer && abilityFlag(killer, 'devours') && !isFainted(killer)) {
          this.heal(killer, Math.floor(killer.stats.hp / 2), true);
          this.log(`${this.name(killer)} feeds on the victory!`);
        }
      }
    }

    const playerAlive = this.sides.player.party.some((m) => !isFainted(m));
    const foeAlive = this.sides.foe.party.some((m) => !isFainted(m));

    if (!foeAlive) {
      this.finishVictory();
      return;
    }
    if (!playerAlive) {
      this.log('You are out of usable creatures...');
      this.finish('defeat');
      return;
    }

    if (isFainted(this.foeMon)) {
      const options = this.switchableIndices('foe');
      if (options.length) {
        const next = this.chooseFoeSwitch(options);
        this.switchIn('foe', next, { silent: true });
      }
    }
    if (isFainted(this.playerMon)) {
      this.awaitingSwitch = 'player';
      this.state = 'awaitSwitch';
      this.push({ t: 'requestSwitch', side: 'player' });
    }
  }

  awardSpoils(fallen) {
    const participants = this.sides.player.party.filter(
      (m) => this.participants.has(m.uid) && !isFainted(m)
    );
    const receivers = participants.length ? participants : [this.playerMon];
    for (const mon of receivers) {
      const amount = expAward(fallen, mon.level, {
        trainer: !!this.trainer,
        shared: receivers.length,
      });
      const before = mon.level;
      const result = gainExp(mon, amount);
      applyTrainingYield(mon, fallen.species);
      addFriendship(mon, 3);
      this.push({
        t: 'exp',
        uid: mon.uid,
        amount: result.gained,
        levels: result.levels,
        name: displayName(mon),
      });
      this.log(`${displayName(mon)} gained ${result.gained} EXP.`);
      for (const lv of result.levels) {
        this.log(`${displayName(mon)} grew to level ${lv.level}!`);
        this.push({ t: 'levelup', uid: mon.uid, level: lv.level, moves: lv.moves });
      }
      this.expResults.push({ uid: mon.uid, from: before, to: mon.level, moves: result.levels });
    }

    if (this.isWild) {
      const species = getSpecies(fallen.species);
      let money = Math.floor(species.baseMoney * fallen.level * 0.35);
      const bonus = abilityFlag(this.playerMon, 'moneyBonus');
      if (bonus) money = Math.floor(money * bonus);
      this.moneyEarned += money;
    }
  }

  finishVictory() {
    if (this.state === 'ended') return;
    if (this.trainer) {
      this.log(`${this.trainer.name} is out of usable creatures!`);
      if (this.trainer.dialogue && this.trainer.dialogue.defeat) this.log(this.trainer.dialogue.defeat);
      let prize = this.trainer.prize || 0;
      const held = this.playerMon && this.playerMon.held ? getItem(this.playerMon.held) : null;
      if (held && held.hold && held.hold.moneyMult) prize = Math.floor(prize * held.hold.moneyMult);
      this.moneyEarned += prize;
      if (prize) this.log(`You got ${prize} shards for winning!`);
    }
    this.finish('victory');
  }

  finish(outcome) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.outcome = outcome;
    // Battle-only state should not leak into the overworld.
    for (const key of ['player', 'foe']) {
      for (const mon of this.sides[key].party) {
        clearCombatState(mon);
        delete mon.flags.fainted;
      }
    }
    this.push({ t: 'end', outcome, money: this.moneyEarned, caught: this.caught ? this.caught.uid : null });
  }

  // ── Foe decision-making ──────────────────────────────────────────────────
  chooseFoeAction() {
    const foe = this.foeMon;
    if (!foe || isFainted(foe)) return { type: 'none' };
    return this.aiChoose(foe);
  }

  chooseFoeSwitch(options) {
    // Prefer whichever bench creature matches up best against the player.
    const player = this.playerMon;
    let best = options[0];
    let bestScore = -Infinity;
    for (const index of options) {
      const candidate = this.sides.foe.party[index];
      const score = this.matchupScore(candidate, player);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    }
    return best;
  }

  matchupScore(mon, foe) {
    const myTypes = getSpecies(mon.species).types;
    const foeTypes = getSpecies(foe.species).types;
    let offense = 0;
    for (const t of myTypes) offense = Math.max(offense, effectiveness(t, foeTypes));
    let defense = 0;
    for (const t of foeTypes) defense = Math.max(defense, effectiveness(t, myTypes));
    return offense * 2 - defense + (mon.hp / mon.stats.hp) * 1.5;
  }

  aiChoose(mon) {
    const level = this.trainer ? this.trainer.ai || 2 : 1;
    const options = this.availableMoves(mon);
    if (!options.length) return { type: 'struggle' };
    const target = this.playerMon;

    if (level <= 1) {
      // Wild creatures pick more or less at random, with a slight preference
      // for attacking moves.
      const attacks = options.filter(({ slot }) => getMove(slot.id).category !== 'status');
      const pool = attacks.length && this.rng.percent(75) ? attacks : options;
      return { type: 'move', index: this.rng.pick(pool).index };
    }

    const scored = options.map(({ slot, index }) => ({
      index,
      score: this.scoreMove(mon, target, getMove(slot.id), level),
    }));
    scored.sort((a, b) => b.score - a.score);

    // Smarter trainers occasionally switch when badly outmatched.
    if (level >= 3 && this.trainer) {
      const bench = this.switchableIndices('foe');
      if (bench.length && this.matchupScore(mon, target) < 0.6 && this.rng.percent(35)) {
        const best = this.chooseFoeSwitch(bench);
        if (this.matchupScore(this.sides.foe.party[best], target) > this.matchupScore(mon, target) + 1) {
          return { type: 'switch', index: best };
        }
      }
      // And they use items on a badly hurt ace.
      if (this.trainer.items && this.trainer.items.length && mon.hp < mon.stats.hp * 0.28) {
        const itemId = this.trainer.items.shift();
        return { type: 'item', itemId, targetIndex: this.sides.foe.activeIndex };
      }
    }

    if (level >= 2 && this.rng.percent(level >= 4 ? 4 : 18)) {
      return { type: 'move', index: this.rng.pick(scored).index };
    }
    return { type: 'move', index: scored[0].index };
  }

  scoreMove(user, target, move, aiLevel) {
    const targetTypes = getSpecies(target.species).types;
    const userTypes = getSpecies(user.species).types;

    if (move.category === 'status') {
      let score = 12;
      const e = move.effect || {};
      if (e.status) {
        if (target.status) return 1;
        const immune = STATUS_IMMUNE_TYPES[e.status];
        if (immune && targetTypes.some((t) => immune.includes(t))) return 0;
        score += 26;
      }
      if (e.boost) {
        const own = e.target !== 'foe';
        const stages = Object.values(e.boost).reduce((a, b) => a + b, 0);
        const current = Object.keys(e.boost).reduce((a, k) => a + ((own ? user : target).boosts[k] || 0), 0);
        score += stages * (own ? 10 : 8) - current * 6;
        if (own && user.hp < user.stats.hp * 0.4) score -= 15;
      }
      if (e.heal) {
        const missing = 1 - user.hp / user.stats.hp;
        score += missing > 0.45 ? 45 * missing : -25;
      }
      if (e.hazard || e.screen) score += 18;
      if (e.protect) score += user.hp < user.stats.hp * 0.4 ? 14 : 4;
      if (aiLevel < 3) score += this.rng.int(0, 10);
      return score;
    }

    const eff = effectiveness(move.type, targetTypes);
    if (eff === 0) return 0;
    const category = move.category;
    const attack = this.statValue(user, category === 'physical' ? 'atk' : 'spa');
    const defense = this.statValue(target, category === 'physical' ? 'def' : 'spd');
    const estimate =
      (move.power * (attack / Math.max(1, defense)) * eff * stab(move.type, userTypes) * (move.accuracy || 100)) / 100;

    let score = estimate;
    if (aiLevel >= 3 && estimate >= target.hp * 1.6) score += 40; // likely knockout
    if (move.effect && move.effect.recoil) score *= 0.9;
    if (aiLevel < 3) score += this.rng.int(0, 12);
    return score;
  }
}

function statLabel(stat) {
  return {
    atk: 'Attack',
    def: 'Defense',
    spa: 'Sp. Atk',
    spd: 'Sp. Def',
    spe: 'Speed',
    acc: 'accuracy',
    eva: 'evasiveness',
  }[stat] || stat;
}

export { freshBoosts, initCombatState, clearCombatState };
