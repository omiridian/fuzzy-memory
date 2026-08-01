// The game state: everything a save file contains, plus the operations the
// scenes perform on it (using items in the field, recording the dex,
// evolving, healing, warping).

import { Bag } from './inventory.js';
import { Party, Storage, PARTY_MAX } from './party.js';
import { QuestLog } from './questlog.js';
import { RNG } from '../core/rng.js';
import { getItem } from '../data/items.js';
import { getSpecies, DEX_COUNT, DEX } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { NATURE_LIST } from '../data/natures.js';
import {
  createMon,
  refreshStats,
  healFully,
  isFainted,
  checkEvolution,
  evolveMon,
  addTraining,
  addFriendship,
  teachMove,
  canLearnMove,
  gainExp,
  expForLevel,
  rehydrateMon,
  displayName,
  seedMonUid,
  nextMonUid,
} from './monster.js';

export const SAVE_KEY = 'aetherlings.save.v1';
export const SAVE_VERSION = 1;

/** In-game clock: one full day every twelve real minutes. */
const DAY_LENGTH_SECONDS = 720;

export class Game {
  constructor(opts = {}) {
    this.playerName = opts.playerName || 'Wren';
    this.rng = new RNG(opts.seed || Math.floor(Math.random() * 0xffffffff));
    this.bag = new Bag(3000);
    this.party = new Party([]);
    this.storage = new Storage();
    this.quests = new QuestLog(this);
    this.flags = {};
    this.counters = {};
    this.dexSeen = {};
    this.dexCaught = {};
    this.mapId = 'player_home';
    this.x = 6;
    this.y = 5;
    this.dir = 'down';
    this.playTime = 0;
    this.clock = 8 * 60; // in-game minutes since midnight
    this.repelSteps = 0;
    this.lureSteps = 0;
    this.stepsWalked = 0;
    this.lastWaystation = { map: 'hearthvale', x: 14, y: 12 };
    this.badges = [];
    this.starter = null;
    this.evolutionsDone = 0;
    this.battlesWon = 0;
    this.messages = [];
  }

  // ── Flags and counters ───────────────────────────────────────────────────
  getFlag(name) {
    return !!this.flags[name];
  }

  setFlag(name, value = true) {
    if (!name) return [];
    const changed = !!this.flags[name] !== !!value;
    this.flags[name] = value;
    if (!changed) return [];
    return this.quests.refresh();
  }

  bump(counter, amount = 1) {
    this.counters[counter] = (this.counters[counter] || 0) + amount;
    return this.counters[counter];
  }

  count(counter) {
    return this.counters[counter] || 0;
  }

  // ── Time of day ──────────────────────────────────────────────────────────
  tick(dtSeconds) {
    this.playTime += dtSeconds;
    this.clock = (this.clock + (dtSeconds / DAY_LENGTH_SECONDS) * 1440) % 1440;
  }

  get hour() {
    return Math.floor(this.clock / 60);
  }

  get isNight() {
    return this.hour < 6 || this.hour >= 19;
  }

  timeLabel() {
    const h = this.hour;
    if (h < 6) return 'Night';
    if (h < 11) return 'Morning';
    if (h < 17) return 'Afternoon';
    if (h < 19) return 'Evening';
    return 'Night';
  }

  clockString() {
    const h = Math.floor(this.clock / 60);
    const m = Math.floor(this.clock % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ── Dex ──────────────────────────────────────────────────────────────────
  recordSeen(speciesId) {
    if (!DEX[speciesId] || this.dexSeen[speciesId]) return false;
    this.dexSeen[speciesId] = true;
    return true;
  }

  recordCaught(speciesId) {
    if (!DEX[speciesId]) return false;
    this.dexSeen[speciesId] = true;
    const isNew = !this.dexCaught[speciesId];
    this.dexCaught[speciesId] = true;
    if (isNew) {
      const total = this.caughtCount();
      if (total >= 50) this.setFlag('dex_50');
      if (total >= 150) this.setFlag('dex_150');
      if (total >= DEX_COUNT) this.setFlag('dex_complete');
    }
    return isNew;
  }

  seenCount() {
    return Object.keys(this.dexSeen).length;
  }

  caughtCount() {
    return Object.keys(this.dexCaught).length;
  }

  // ── Party management ─────────────────────────────────────────────────────
  /** Adds a creature to the party, or to storage if the party is full. */
  receiveMon(mon, { fromCatch = false } = {}) {
    mon.originalTrainer = mon.originalTrainer || this.playerName;
    mon.metDate = mon.metDate || Math.floor(this.playTime);
    mon.caughtAt = mon.caughtAt || this.mapId;
    this.recordCaught(mon.species);
    if (fromCatch) {
      this.setFlag('first_catch');
      this.bump('caught');
    }
    if (this.party.add(mon)) return { where: 'party' };
    const box = this.storage.deposit(mon);
    return { where: 'storage', box };
  }

  healParty() {
    this.party.healAll();
  }

  /** Marks where the player respawns after a blackout. */
  setWaystation(mapId, x, y) {
    this.lastWaystation = { map: mapId, x, y };
  }

  // ── Evolution ────────────────────────────────────────────────────────────
  /**
   * Checks the whole party for pending evolutions.
   * @returns array of { mon, evo } for the UI to walk through.
   */
  pendingEvolutions(trigger = 'level', item = null) {
    const out = [];
    for (const mon of this.party.mons) {
      const evo = checkEvolution(mon, { trigger, item, isNight: this.isNight });
      if (evo) out.push({ mon, evo });
    }
    return out;
  }

  applyEvolution(mon, evo) {
    const result = evolveMon(mon, evo.to);
    if (result) {
      this.recordCaught(evo.to);
      this.evolutionsDone++;
      this.bump('evolutions');
      if (this.evolutionsDone >= 5) this.setFlag('evolved_5');
    }
    return result;
  }

  // ── Items outside battle ─────────────────────────────────────────────────
  /**
   * Uses an item in the field.
   * @returns { ok, message, needsTarget, evolution, learn }
   */
  useItem(itemId, targetIndex = null, extra = {}) {
    const item = getItem(itemId);
    if (!item) return { ok: false, message: 'Nothing happens.' };
    if (!this.bag.has(itemId) && !item.key) return { ok: false, message: 'You have none left.' };
    const effect = item.effect || {};
    const mon = targetIndex === null ? null : this.party.get(targetIndex);

    const needsTarget =
      effect.heal !== undefined ||
      effect.revive !== undefined ||
      effect.cure !== undefined ||
      effect.train !== undefined ||
      effect.levelUp !== undefined ||
      effect.friendship !== undefined ||
      effect.evolutionStone !== undefined ||
      effect.teach !== undefined ||
      effect.swapAbility ||
      effect.hiddenAbility ||
      effect.rerollNature ||
      effect.pp !== undefined ||
      effect.ppAll !== undefined;

    if (needsTarget && !mon) return { ok: false, needsTarget: true };

    const consume = () => {
      if (item.consumable && !item.key) this.bag.remove(itemId, 1);
    };

    if (effect.heal !== undefined) {
      if (isFainted(mon)) return { ok: false, message: `${displayName(mon)} has fainted.` };
      if (mon.hp >= mon.stats.hp && effect.cure === undefined) {
        return { ok: false, message: `${displayName(mon)} is already healthy.` };
      }
      const before = mon.hp;
      mon.hp = Math.min(mon.stats.hp, mon.hp + (effect.heal === 'full' ? mon.stats.hp : effect.heal));
      if (effect.cure === 'all') mon.status = null;
      consume();
      return { ok: true, message: `${displayName(mon)} recovered ${mon.hp - before} HP.` };
    }

    if (effect.revive !== undefined) {
      if (!isFainted(mon)) return { ok: false, message: `${displayName(mon)} is not fainted.` };
      mon.hp = Math.max(1, Math.floor(mon.stats.hp * effect.revive));
      mon.status = null;
      consume();
      return { ok: true, message: `${displayName(mon)} is back on its feet.` };
    }

    if (effect.cure !== undefined) {
      const curable = effect.cure === 'all' || (Array.isArray(effect.cure) && effect.cure.includes(mon.status));
      if (!mon.status || !curable) return { ok: false, message: 'It would have no effect.' };
      mon.status = null;
      mon.statusTurns = 0;
      consume();
      return { ok: true, message: `${displayName(mon)} feels better.` };
    }

    if (effect.pp !== undefined || effect.ppAll !== undefined) {
      let restored = false;
      for (const slot of mon.moves) {
        if (slot.pp < slot.maxPp) {
          restored = true;
          if (effect.ppAll !== undefined) slot.pp = Math.min(slot.maxPp, slot.pp + effect.ppAll);
          else {
            slot.pp = effect.pp === 'full' ? slot.maxPp : Math.min(slot.maxPp, slot.pp + effect.pp);
            break;
          }
        }
      }
      if (!restored) return { ok: false, message: 'Its moves are already full.' };
      consume();
      return { ok: true, message: `${displayName(mon)} regained PP.` };
    }

    if (effect.train) {
      const applied = addTraining(mon, effect.train, effect.amount);
      if (!applied) return { ok: false, message: `${displayName(mon)} cannot take any more.` };
      consume();
      return { ok: true, message: `${displayName(mon)}'s training rose by ${applied}.` };
    }

    if (effect.friendship) {
      addFriendship(mon, effect.friendship);
      consume();
      return { ok: true, message: `${displayName(mon)} seems fonder of you.` };
    }

    if (effect.levelUp) {
      if (mon.level >= 100) return { ok: false, message: `${displayName(mon)} cannot grow further.` };
      const species = getSpecies(mon.species);
      const needed = expForLevel(species.growthRate, mon.level + 1) - mon.exp;
      const result = gainExp(mon, Math.max(1, needed));
      consume();
      return {
        ok: true,
        message: `${displayName(mon)} grew to level ${mon.level}!`,
        levelUp: true,
        learned: result.levels.flatMap((l) => l.moves),
        mon,
      };
    }

    if (effect.evolutionStone) {
      const evo = checkEvolution(mon, { trigger: 'item', item: effect.evolutionStone, isNight: this.isNight });
      if (!evo) return { ok: false, message: 'It had no effect on this creature.' };
      consume();
      return { ok: true, evolution: { mon, evo }, message: null };
    }

    if (effect.teach) {
      const move = getMove(effect.teach);
      if (!canLearnMove(mon.species, effect.teach)) {
        return { ok: false, message: `${displayName(mon)} cannot learn ${move.name}.` };
      }
      if (mon.moves.some((m) => m.id === effect.teach)) {
        return { ok: false, message: `${displayName(mon)} already knows ${move.name}.` };
      }
      if (mon.moves.length < 4) {
        teachMove(mon, effect.teach);
        return { ok: true, message: `${displayName(mon)} learned ${move.name}!` };
      }
      return { ok: true, learn: { mon, moveId: effect.teach } };
    }

    if (effect.swapAbility) {
      const species = getSpecies(mon.species);
      if (species.abilities.length < 2) return { ok: false, message: 'It has no other ability.' };
      const index = species.abilities.indexOf(mon.ability);
      mon.ability = species.abilities[(index + 1) % species.abilities.length];
      consume();
      return { ok: true, message: `${displayName(mon)}'s ability changed.` };
    }

    if (effect.hiddenAbility) {
      const species = getSpecies(mon.species);
      if (!species.hiddenAbility) return { ok: false, message: 'Nothing lies beneath.' };
      if (mon.ability === species.hiddenAbility) return { ok: false, message: 'It already has it.' };
      mon.ability = species.hiddenAbility;
      consume();
      return { ok: true, message: `${displayName(mon)}'s hidden ability surfaced!` };
    }

    if (effect.rerollNature) {
      const current = mon.nature;
      let next = current;
      while (next === current) next = this.rng.pick(NATURE_LIST);
      mon.nature = next;
      refreshStats(mon);
      consume();
      return { ok: true, message: `${displayName(mon)} settled into a ${next} nature.` };
    }

    if (effect.repel) {
      this.repelSteps = effect.repel;
      consume();
      return { ok: true, message: 'Weaker creatures will keep their distance.' };
    }

    if (effect.lure) {
      this.lureSteps = effect.lure;
      consume();
      return { ok: true, message: 'Something sweet drifts on the air.' };
    }

    if (effect.escape) {
      consume();
      return { ok: true, warp: { ...this.lastWaystation }, message: 'The waystone pulls you home.' };
    }

    if (effect.restParty) {
      this.healParty();
      consume();
      return { ok: true, message: 'You make camp. Everyone recovers completely.' };
    }

    if (effect.fish) {
      return { ok: true, fish: effect.fish };
    }

    return { ok: false, message: `The ${item.name} did nothing here.` };
  }

  /** Walking bookkeeping: repel/lure counters. */
  step() {
    this.stepsWalked++;
    if (this.repelSteps > 0) this.repelSteps--;
    if (this.lureSteps > 0) this.lureSteps--;
  }

  // ── Saving ───────────────────────────────────────────────────────────────
  serialize() {
    return {
      version: SAVE_VERSION,
      playerName: this.playerName,
      rng: this.rng.serialize(),
      bag: this.bag.serialize(),
      party: this.party.serialize(),
      storage: this.storage.serialize(),
      quests: this.quests.serialize(),
      flags: this.flags,
      counters: this.counters,
      dexSeen: this.dexSeen,
      dexCaught: this.dexCaught,
      mapId: this.mapId,
      x: this.x,
      y: this.y,
      dir: this.dir,
      playTime: this.playTime,
      clock: this.clock,
      lastWaystation: this.lastWaystation,
      badges: this.badges,
      starter: this.starter,
      evolutionsDone: this.evolutionsDone,
      battlesWon: this.battlesWon,
      stepsWalked: this.stepsWalked,
    };
  }

  static deserialize(data) {
    const game = new Game({ playerName: data.playerName });
    if (data.rng) game.rng = RNG.deserialize(data.rng);
    game.bag = Bag.deserialize(data.bag || {});
    game.party = new Party((data.party || []).map(rehydrateMon).filter(Boolean));
    game.storage = Storage.deserialize(data.storage);
    for (const box of game.storage.boxes) box.mons = box.mons.map(rehydrateMon).filter(Boolean);
    game.quests = new QuestLog(game);
    game.quests.load(data.quests);
    game.flags = data.flags || {};
    game.counters = data.counters || {};
    game.dexSeen = data.dexSeen || {};
    game.dexCaught = data.dexCaught || {};
    game.mapId = data.mapId || 'hearthvale';
    game.x = data.x || 1;
    game.y = data.y || 1;
    game.dir = data.dir || 'down';
    game.playTime = data.playTime || 0;
    game.clock = data.clock || 480;
    game.lastWaystation = data.lastWaystation || { map: 'hearthvale', x: 14, y: 12 };
    game.badges = data.badges || [];
    game.starter = data.starter || null;
    game.evolutionsDone = data.evolutionsDone || 0;
    game.battlesWon = data.battlesWon || 0;
    game.stepsWalked = data.stepsWalked || 0;
    // Keep freshly minted uids from colliding with loaded ones.
    seedMonUid(game.party.length + game.storage.count() + 2);
    return game;
  }

  save(storageProvider) {
    const payload = JSON.stringify(this.serialize());
    try {
      (storageProvider || globalThis.localStorage).setItem(SAVE_KEY, payload);
      return true;
    } catch (err) {
      return false;
    }
  }

  static load(storageProvider) {
    try {
      const raw = (storageProvider || globalThis.localStorage).getItem(SAVE_KEY);
      if (!raw) return null;
      return Game.deserialize(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  static hasSave(storageProvider) {
    try {
      return !!(storageProvider || globalThis.localStorage).getItem(SAVE_KEY);
    } catch (err) {
      return false;
    }
  }

  static clearSave(storageProvider) {
    try {
      (storageProvider || globalThis.localStorage).removeItem(SAVE_KEY);
    } catch (err) {
      /* ignore */
    }
  }
}

export { createMon, nextMonUid, PARTY_MAX };
