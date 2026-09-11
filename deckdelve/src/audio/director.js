// The bridge between what happens in the dungeon and what you hear.
//
// The simulation does not know this file exists: it calls `signal(name, data)`,
// which is a no-op unless something has attached. This is the something.

import { AudioEngine } from './engine.js';
import { playSound } from './sfx.js';
import { MusicDirector, modeForBiomes } from './music.js';

const ATTACK_SOUND = {
  melee: 'hit_melee',
  arrow: 'hit_arrow',
  bolt: 'hit_magic',
  ember: 'hit_fire',
};

const ABILITY_SOUND = {
  mend: 'heal',
  bulwark: 'bless',
  arcane_ward: 'bless',
  frost_nova: 'hit_magic',
  smite: 'hit_crit',
  cleave: 'hit_melee',
  backstab: 'hit_crit',
  venom_edge: 'hit_magic',
  volley: 'hit_arrow',
  mark_quarry: 'ui_select',
};

const CARD_SOUND = {
  place: 'card_place',
  rotate: 'card_rotate',
  reject: 'ui_deny',
  throw: 'ui_deny',
  draw: 'card_draw',
};

const FINISH_SOUND = {
  extracted: 'extract',
  victory: 'victory',
  wiped: 'wipe',
  timeout: 'wipe',
};

/**
 * Which sound an event asks for, as a plain function of the event. Kept apart
 * from the director so a test can check every branch names a sound that exists
 * — a typo here would otherwise be silent for the life of the game.
 */
export function soundForEvent(name, data = {}) {
  switch (name) {
    case 'attack':
      return data.crit ? 'hit_crit' : ATTACK_SOUND[data.kind] || 'hit_melee';
    case 'ability':
      return ABILITY_SOUND[data.id] || 'ui_select';
    case 'hurt':
      return 'hurt';
    case 'heal':
      return 'heal';
    case 'kill':
      if (data.boss) return 'boss_die';
      if (data.side === 'party') return 'adventurer_die';
      return data.elite ? 'elite_die' : 'enemy_die';
    case 'flee':
      return 'flee';
    case 'loot':
      return data.gear ? 'gear' : 'loot';
    case 'level':
      return 'level_up';
    case 'trap':
      return 'trap';
    case 'room_enter':
      return 'room_enter';
    case 'room_clear':
      return 'room_clear';
    case 'card':
      return CARD_SOUND[data.action] || 'card_draw';
    case 'biome':
      return 'biome';
    case 'boss_intro':
      return 'boss_intro';
    case 'threat_band':
      return 'threat_band';
    case 'finish':
      return FINISH_SOUND[data.outcome] || 'extract';
    default:
      return null;
  }
}

export class AudioDirector {
  constructor() {
    this.engine = new AudioEngine();
    this.music = new MusicDirector(this.engine);
    this.enabled = true;
    this.expedition = null;
    this.wanted = null;
    this.modeTimer = 0;
  }

  get available() {
    return this.engine.available;
  }

  get muted() {
    return !this.enabled;
  }

  /** Called from the first real gesture, which is the only time it can work. */
  unlock() {
    if (!this.enabled) return false;
    const ok = this.engine.unlock();
    if (ok && this.wanted) this.music.setTrack(this.wanted);
    return ok;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.engine.setMuted(!this.enabled);
    if (this.enabled) {
      this.unlock();
      if (this.wanted) this.music.setTrack(this.wanted);
    } else {
      this.music.stopDrone();
    }
    return this.enabled;
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }

  play(name) {
    if (!this.enabled) return false;
    return playSound(this.engine, name);
  }

  /** Which piece should be playing. Remembered until audio is allowed. */
  setScene(scene) {
    const track = scene === 'expedition' ? 'expedition' : scene === 'guild' ? 'guild' : scene === 'title' ? 'title' : null;
    this.wanted = track;
    if (this.engine.available) this.music.setTrack(track);
  }

  /** Wires an expedition's events to the sound bank. */
  attach(expedition) {
    this.expedition = expedition;
    expedition.onEvent = (name, data) => this.event(name, data);
  }

  detach() {
    if (this.expedition) this.expedition.onEvent = null;
    this.expedition = null;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  event(name, data = {}) {
    if (!this.enabled) return;
    const sound = soundForEvent(name, data);
    if (sound) this.play(sound);
    if (name === 'finish') this.music.setTrack(null);
  }

  // -------------------------------------------------------------------------
  // The mix follows the run
  // -------------------------------------------------------------------------

  update(dt, exp) {
    if (!this.enabled) return;
    if (exp && !exp.outcome) {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.modeTimer = 2;
        this.music.setState({
          threat: exp.threat.value,
          combat: anyoneFighting(exp),
          boss: exp.enemies.some((e) => e.alive && e.boss),
          mode: modeForBiomes(biomeTagCounts(exp)),
          depth: exp.dungeon.deepestEntered(),
        });
      }
    }
    this.music.update();
  }
}

function anyoneFighting(exp) {
  for (const adv of exp.party) {
    if (adv.alive && adv.state === 'fighting') return true;
  }
  return false;
}

/** How much of each tag the dungeon's biomes are made of, for the key. */
function biomeTagCounts(exp) {
  const counts = {};
  for (const room of exp.dungeon.rooms.values()) {
    if (!room.biome || !room.entered) continue;
    for (const tag of room.tags) counts[tag] = (counts[tag] || 0) + 1;
  }
  return counts;
}
