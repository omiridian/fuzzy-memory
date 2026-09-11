// The expedition: one run, from the rope ladder to whatever happens next.
//
// This object is the `world` that the AI and combat systems talk to. It owns
// the dungeon, the party, the monsters, the deck, the Threat and the chronicle,
// and it is deliberately free of anything to do with drawing.

import { Dungeon } from './dungeon.js';
import { Deck } from './deck.js';
import { Threat } from './threat.js';
import { Chronicle } from './log.js';
import { choosePartyObjective, updateAdventurer, updateEnemy } from './ai.js';
import { applyDamage, applyStatus, healActor } from './combat.js';
import { createEnemy, deployAdventurer, grantXp } from './actors.js';
import { biomeOf } from './biomes.js';
import { doorPoint, hasDoor, key, linkedNeighbors, roomBounds, roomCenter } from './grid.js';
import { SIDES } from '../data/cards.js';
import { getEvent } from '../data/events.js';
import { BARKS, OBITUARIES } from '../data/names.js';
import { GEAR_BY_ID, gearFor } from '../data/equipment.js';
import { getBiome } from '../data/biomes.js';
import { BOSSES } from '../data/enemies.js';
import { dist } from '../core/util.js';

const OBJECTIVE_INTERVAL = 0.7;
// A card's printed Threat is its risk rating; this is how much of it the
// dungeon actually notices when you build the thing.
const PLACEMENT_THREAT = 0.6;

export class Expedition {
  constructor({ rng, roster, deckCards, guild }) {
    this.rng = rng;
    this.guild = guild || {};
    this.dungeon = new Dungeon(rng.fork());
    this.deck = new Deck(deckCards, rng.fork());
    this.threat = new Threat();
    this.chronicle = new Chronicle();
    this.time = 0;
    this.graphVersion = 1;
    this.entranceCell = { x: 0, y: 0 };
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floaters = [];
    this.partyObjective = null;
    this.objectiveTimer = 0;
    this.outcome = null;
    this.extracting = false;
    this.bossSlain = false;
    this.miniBossSlain = false;
    this.roomsPlaced = 0;
    this.kills = 0;
    this.eliteKills = 0;
    this.goldFever = false;
    this.dead = [];
    this.newBiomeFlash = null;
    this.paused = false;
    this.speed = 1;
    this.clearedBiomes = new Set();

    const c = roomCenter(0, 0);
    this.party = roster.map((adv, i) => {
      const angle = (i / roster.length) * Math.PI * 2;
      return deployAdventurer(adv, c.x + Math.cos(angle) * 16, c.y + Math.sin(angle) * 16 + 10);
    });

    this.deck.fill();
    this.chronicle.write('The rope ladder creaks. Four of yours go down into the dark.', 'good');
    this.chronicle.write('Place a room card to give them somewhere to go.', 'plain');
  }

  // -------------------------------------------------------------------------
  // Queries used by the AI and combat
  // -------------------------------------------------------------------------

  get living() {
    return this.party.filter((a) => a.alive);
  }

  partyById(id) {
    return this.party.find((a) => a.id === id && a.alive) || null;
  }

  enemyById(id) {
    return this.enemies.find((e) => e.id === id && e.alive) || null;
  }

  /**
   * Sight is room-shaped: nobody targets through masonry. The one exception is
   * a doorway, where two bodies standing either side of the same gap can reach
   * each other — which is how holding a door is supposed to work, and stops a
   * monster reaching through a wall at somebody who cannot reach back.
   */
  canEngage(a, b) {
    if (a.roomKey === b.roomKey) return true;
    const ra = this.dungeon.rooms.get(a.roomKey);
    const rb = this.dungeon.rooms.get(b.roomKey);
    if (!ra || !rb) return false;
    if (Math.abs(ra.x - rb.x) + Math.abs(ra.y - rb.y) !== 1) return false;
    const side = SIDES.findIndex((s) => s.dx === rb.x - ra.x && s.dy === rb.y - ra.y);
    if (side < 0 || !hasDoor(ra.doors, side)) return false;
    const gap = doorPoint(ra.x, ra.y, side);
    return dist(a.x, a.y, gap.x, gap.y) <= 40 && dist(b.x, b.y, gap.x, gap.y) <= 40;
  }

  hostilesNear(actor, radius) {
    const pool = actor.side === 'party' ? this.enemies : this.party;
    const out = [];
    for (const other of pool) {
      if (!other.alive) continue;
      if (dist(actor.x, actor.y, other.x, other.y) > radius) continue;
      if (!this.canEngage(actor, other)) continue;
      out.push(other);
    }
    return out;
  }

  alliesNear(actor, radius) {
    const pool = actor.side === 'party' ? this.party : this.enemies;
    return pool.filter(
      (o) => o.alive && o !== actor && dist(actor.x, actor.y, o.x, o.y) <= radius && this.canEngage(actor, o),
    );
  }

  partyCentroid() {
    const alive = this.living;
    if (!alive.length) return roomCenter(0, 0);
    let x = 0;
    let y = 0;
    for (const a of alive) {
      x += a.x;
      y += a.y;
    }
    return { x: x / alive.length, y: y / alive.length };
  }

  roomHasBusiness(roomKey) {
    const room = this.dungeon.rooms.get(roomKey);
    if (!room) return false;
    if (!room.entered) return true;
    const b = this.dungeon.roomBusiness(room);
    return !!(room.enemyIds.length || b.pendingLoot || b.pendingFeatures.length);
  }

  /** Biome auras that drag on movement. */
  roomSlow(roomKey) {
    const room = this.dungeon.rooms.get(roomKey);
    const aura = room && room.biome ? biomeOf(room.biome).aura : null;
    let mult = 1;
    if (aura && aura.slow) mult *= 1 - aura.slow;
    if (room && room.floor === 'water') mult *= 0.82;
    return mult;
  }

  roomRegen(roomKey) {
    const room = this.dungeon.rooms.get(roomKey);
    const aura = room && room.biome ? biomeOf(room.biome).aura : null;
    let mult = 1;
    if (aura && aura.regen) mult *= 1 + aura.regen * 0.25;
    if (room && (room.card === 'camp' || room.isEntrance)) mult *= 1.8;
    return mult;
  }

  // -------------------------------------------------------------------------
  // Chronicle & effects
  // -------------------------------------------------------------------------

  note(text, kind = 'plain', meta) {
    return this.chronicle.write(text, kind, meta);
  }

  bark(adv, kind) {
    const lines = BARKS[kind];
    if (!lines) return;
    this.chronicle.write(`${adv.name}: "${this.rng.pick(lines)}"`, 'bark');
  }

  floatText(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 0.9, vy: -22 });
    if (this.floaters.length > 90) this.floaters.shift();
  }

  burst(x, y, radius, color) {
    const count = Math.min(22, 6 + Math.round(radius / 5));
    for (let i = 0; i < count; i++) {
      const a = this.rng.float(0, Math.PI * 2);
      const sp = this.rng.float(radius * 0.5, radius * 1.6);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: this.rng.float(0.25, 0.55), max: 0.55, color, r: this.rng.float(1.4, 3.2),
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  dust(x, y, color = '#c9b899', count = 14) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.float(0, Math.PI * 2);
      this.particles.push({
        x, y, vx: Math.cos(a) * this.rng.float(20, 90), vy: Math.sin(a) * this.rng.float(20, 90),
        life: this.rng.float(0.4, 0.9), max: 0.9, color, r: this.rng.float(1.5, 4),
      });
    }
  }

  spawnProjectile(spec) {
    const dx = spec.tx - spec.x;
    const dy = spec.ty - spec.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = spec.kind === 'arrow' ? 300 : 230;
    this.projectiles.push({
      ...spec,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      life: 2.2,
    });
  }

  // -------------------------------------------------------------------------
  // Card placement
  // -------------------------------------------------------------------------

  canPlaceEntry(entry, gx, gy) {
    if (entry.card.minDepth) {
      const reach = this.dungeon.deepestPlaced ? this.dungeon.deepestPlaced() : 0;
      const depthHere = this.depthOfCell(gx, gy);
      if (depthHere !== null && depthHere < entry.card.minDepth) {
        return { ok: false, reason: `${entry.card.name} will not open this close to daylight.` };
      }
      void reach;
    }
    return this.dungeon.canPlace(gx, gy, this.deck.doorsOf(entry));
  }

  /** Depth the cell would have, judged by its shallowest linked neighbour. */
  depthOfCell(gx, gy) {
    let best = null;
    for (const n of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const room = this.dungeon.get(gx + n[0], gy + n[1]);
      if (room && room.reachable) best = best === null ? room.depth + 1 : Math.min(best, room.depth + 1);
    }
    return best;
  }

  placeCard(handUid, gx, gy) {
    const entry = this.deck.find(handUid);
    if (!entry) return { ok: false, reason: 'No such card.' };
    const check = this.canPlaceEntry(entry, gx, gy);
    if (!check.ok) return check;

    const room = this.dungeon.place(entry.id, gx, gy, entry.rotation);
    if (!room) return { ok: false, reason: 'That will not fit.' };
    this.deck.consume(handUid);
    this.roomsPlaced += 1;
    this.graphVersion += 1;

    const c = roomCenter(gx, gy);
    this.dust(c.x, c.y, '#b9a684', 26);
    if (entry.card.threat) this.threat.add(entry.card.threat * PLACEMENT_THREAT, `built the ${room.name}`);
    this.note(`You set down the ${room.name}. ${room.blurb}`, 'plain');

    const fresh = this.dungeon.takeNewBiomes();
    for (const biome of fresh) this.announceBiome(biome);
    return { ok: true, room };
  }

  announceBiome(biome) {
    this.note(biome.announce, 'biome');
    this.note(biome.blurb, 'plain');
    this.threat.add(biome.threat || 0, `the ${biome.name} formed`);
    this.newBiomeFlash = { biome, t: 3.2 };
    if (biome.aura && biome.aura.greedPull) this.goldFever = true;
  }

  mulligan(handUid) {
    const result = this.deck.mulligan(handUid);
    if (result) {
      this.threat.add(2, 'threw a card back into the dark');
      this.note('You put a card back. The dungeon notices the indecision.', 'plain');
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

  onAdventurerEnteredRoom(adv, room) {
    if (!room.entered) {
      room.entered = true;
      this.note(`${adv.name} steps into the ${room.name}. ${room.discovery}`, 'good');
      this.bark(adv, 'enter_room');
      const plan = this.dungeon.reveal(room, { threat: this.threat.value, classHint: adv.classId });
      if (plan) this.materialise(room, plan, adv);
      if (room.hazard && room.hazardArmed) this.springHazard(adv, room);
    }
    // Scouts read the next room from the doorway.
    if (adv.scout) {
      for (const n of linkedNeighbors(this.dungeon.rooms, room.x, room.y)) {
        const other = this.dungeon.rooms.get(key(n.x, n.y));
        if (other && !other.entered && !other.scouted) {
          other.scouted = true;
          this.note(`${adv.name} reads the next doorway: the ${other.name} lies beyond.`, 'plain');
        }
      }
    }
  }

  /** Turns a revealed plan into live monsters standing in the room. */
  materialise(room, plan, adv) {
    const b = roomBounds(room.x, room.y);
    const biome = biomeOf(room.biome);
    const bonus = biome ? biome.enemyBonus : null;

    for (const spec of plan.spawns) {
      const x = this.rng.float(b.left + 14, b.right - 14);
      const y = this.rng.float(b.top + 14, b.bottom - 14);
      const enemy = createEnemy(spec.type, x, y, room.key, {
        threat: this.threat.value,
        depth: room.depth,
        elite: spec.elite,
        prefix: spec.elite ? this.rng.pick(BOSS_FREE_PREFIXES) : null,
        biomeBonus: bonus,
      });
      this.addEnemy(enemy, room);
    }

    if (plan.boss) {
      const def = BOSSES[plan.boss];
      const c = roomCenter(room.x, room.y);
      const boss = createEnemy(plan.boss, c.x, c.y - 8, room.key, {
        threat: this.threat.value,
        depth: room.depth,
      });
      this.addEnemy(boss, room);
      this.note(def.intro, 'boss');
      this.threat.add(8, `woke ${def.name}`);
    }

    if (plan.spawns.length) {
      const names = {};
      for (const e of room.enemyIds) {
        const foe = this.enemyById(e);
        if (foe) names[foe.name] = (names[foe.name] || 0) + 1;
      }
      const list = Object.entries(names).map(([n, c]) => (c > 1 ? `${c} ${n}s` : n)).join(', ');
      if (list) this.note(`The room is not empty: ${list}.`, 'bad');
    } else if (!plan.boss) {
      this.note(`Nothing moves in the ${room.name}. ${adv.name} does not relax.`, 'plain');
    }
  }

  addEnemy(enemy, room) {
    this.enemies.push(enemy);
    room.enemyIds.push(enemy.id);
  }

  /** A boss calling for help. The help arrives in the boss's own room. */
  summon(summoner, typeId, count = 1) {
    const room = this.dungeon.rooms.get(summoner.roomKey);
    if (!room) return [];
    const made = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.rng.float(0, 1);
      const foe = createEnemy(
        typeId,
        summoner.x + Math.cos(angle) * 34,
        summoner.y + Math.sin(angle) * 26,
        room.key,
        { threat: this.threat.value, depth: room.depth },
      );
      this.addEnemy(foe, room);
      made.push(foe);
    }
    room.cleared = false;
    this.burst(summoner.x, summoner.y, 46, summoner.accent || '#ffb347');
    this.note(`${summoner.name} calls, and the room answers: ${count} more.`, 'bad');
    return made;
  }

  springHazard(adv, room) {
    room.hazardArmed = false;
    const event = getEvent(room.hazard);
    if (event) this.resolveEvent(adv, event, room);
  }

  // -------------------------------------------------------------------------
  // Loot and events
  // -------------------------------------------------------------------------

  takeLoot(adv, room) {
    const loot = room.loot;
    if (!loot || loot.taken) return;
    loot.taken = true;

    const biome = biomeOf(room.biome);
    const mult = (1 + (adv.goldBonus || 0)) * (biome && biome.aura && biome.aura.goldMult ? biome.aura.goldMult : 1);
    const gold = Math.round(loot.gold * mult);
    adv.carriedGold += gold;
    this.note(`${adv.name} takes ${loot.name} — ${gold} gold.`, 'loot');
    this.bark(adv, 'loot');
    this.floatText(adv.x, adv.y - 18, `+${gold}g`, '#ffd76b');
    this.threat.add(gold / 55, 'lifted treasure');

    if (loot.gearId) {
      const gear = GEAR_BY_ID[loot.gearId];
      if (gear) {
        adv.carriedLoot.push(loot.gearId);
        this.note(`Also: ${gear.name}. ${adv.name} pockets it without discussion.`, 'loot');
      }
    }

    // Greed has consequences in a vault.
    if (room.card === 'treasure_vault' && this.rng.chance(0.35)) {
      const event = getEvent('mimic_chest');
      if (event) this.resolveEvent(adv, event, room);
    }
    this.checkRoomCleared(room);
  }

  fireFeature(adv, room, feature) {
    feature.used = true;
    const event = feature.eventId ? getEvent(feature.eventId) : null;
    if (!event) {
      this.checkRoomCleared(room);
      return;
    }
    this.resolveEvent(adv, event, room);
    this.checkRoomCleared(room);
  }

  /** Rolls one weighted outcome and applies every effect it carries. */
  resolveEvent(adv, event, room) {
    this.note(event.text.replace(/\{who\}/g, adv.name), 'plain');
    const pool = event.outcomes.filter((o) => !o.requireScout || adv.scout);
    const outcome = this.rng.weighted(pool.length ? pool : event.outcomes);
    this.note(outcome.text.replace(/\{who\}/g, adv.name), outcome.damage ? 'bad' : 'good');

    if (outcome.xp) {
      const res = grantXp(adv, outcome.xp);
      if (res.levels.length) this.note(`${adv.name} reaches level ${adv.level}.`, 'good');
    }
    if (outcome.damage) {
      applyDamage(null, adv, outcome.damage, this, { kind: 'tick' });
    }
    if (outcome.gold) {
      if (outcome.gold > 0) {
        adv.carriedGold += outcome.gold;
        this.floatText(adv.x, adv.y - 18, `+${outcome.gold}g`, '#ffd76b');
        this.threat.add(outcome.gold / 60, 'took more than was offered');
      } else {
        const paid = Math.min(adv.carriedGold, -outcome.gold);
        adv.carriedGold -= paid;
        this.floatText(adv.x, adv.y - 18, `-${paid}g`, '#c9b0b0');
      }
    }
    if (outcome.healParty) {
      for (const a of this.living) healActor(a, a.maxHp * outcome.healParty, this);
      this.burst(adv.x, adv.y, 40, '#ffe9a8');
    }
    if (outcome.status) {
      applyStatus(adv, outcome.status, outcome.duration || 10, outcome.power || 1, null);
    }
    if (outcome.threat) this.threat.add(outcome.threat, 'disturbed something');
    if (outcome.reveal) this.revealAhead(outcome.reveal);
    if (outcome.gear) {
      const pool = gearFor(adv.classId, outcome.gear);
      if (pool.length) {
        const gear = this.rng.pick(pool);
        adv.carriedLoot.push(gear.id);
        this.note(`${adv.name} comes away with ${gear.name}.`, 'loot');
      }
    }
    if (outcome.spawn) {
      const b = roomBounds(room.x, room.y);
      const foe = createEnemy(outcome.spawn, this.rng.float(b.left + 20, b.right - 20), this.rng.float(b.top + 20, b.bottom - 20), room.key, {
        threat: this.threat.value,
        depth: room.depth,
      });
      this.addEnemy(foe, room);
      this.note(`${foe.name} was not there a moment ago.`, 'bad');
    }
    if (outcome.spawnMimic) {
      const c = roomCenter(room.x, room.y);
      const foe = createEnemy('bandit_cutthroat', c.x + 20, c.y, room.key, { threat: this.threat.value, depth: room.depth, elite: true, prefix: 'Hoard-Fat' });
      this.addEnemy(foe, room);
      this.note('Something that was pretending to be a pile of coin stands up.', 'bad');
    }
  }

  revealAhead(count) {
    let revealed = 0;
    for (const room of this.dungeon.list()) {
      if (revealed >= count) break;
      if (room.entered || room.scouted) continue;
      room.scouted = true;
      revealed += 1;
      this.note(`The map gives up a secret: the ${room.name} lies ahead.`, 'good');
    }
  }

  // -------------------------------------------------------------------------
  // Death
  // -------------------------------------------------------------------------

  kill(target, killer) {
    if (!target.alive) return;
    target.alive = false;
    if (target.side === 'foe') {
      this.killEnemy(target, killer);
    } else {
      this.killAdventurer(target, killer);
    }
  }

  killEnemy(enemy, killer) {
    this.kills += 1;
    if (enemy.elite) this.eliteKills += 1;
    this.burst(enemy.x, enemy.y, 20, enemy.color);
    const room = this.dungeon.rooms.get(enemy.roomKey);
    if (room) room.enemyIds = room.enemyIds.filter((id) => id !== enemy.id);

    const gold = Math.round(this.rng.int(enemy.gold[0], enemy.gold[1]) * enemy.goldMult);
    if (gold > 0 && killer && killer.side === 'party') {
      killer.carriedGold += gold;
      this.floatText(enemy.x, enemy.y - 16, `+${gold}g`, '#ffd76b');
    }
    for (const a of this.living) {
      const res = grantXp(a, enemy.xp);
      if (res.levels.length) this.note(`${a.name} reaches level ${a.level}.`, 'good');
    }
    if (killer && killer.side === 'party') killer.runKills += 1;

    this.threat.add(enemy.boss ? 6 : enemy.elite ? 1.4 : 0.45, `killed ${enemy.name}`);

    if (enemy.boss) {
      const def = BOSSES[enemy.type];
      this.note(def.defeat, 'boss');
      if (enemy.type === 'cindervex') {
        this.bossSlain = true;
        this.note('The way out is open, and you have earned it. Extract whenever you like.', 'good');
      } else {
        this.miniBossSlain = true;
      }
    }
    if (enemy.onDeath && enemy.onDeath.spores) {
      for (const a of this.hostilesNear(enemy, 40)) applyStatus(a, 'poison', 5, 2, enemy);
    }
    if (room) this.checkRoomCleared(room);
    this.enemies = this.enemies.filter((e) => e.alive || e.hitFlash > 0);
  }

  killAdventurer(adv, killer) {
    adv.deathRoom = this.dungeon.rooms.get(adv.roomKey) || null;
    this.burst(adv.x, adv.y, 26, adv.color);
    this.bark(adv, 'death');
    const template = this.rng.pick(OBITUARIES);
    const line = template
      .replace('{room}', adv.deathRoom ? adv.deathRoom.name : 'the dark')
      .replace('{depth}', String(adv.deathRoom ? adv.deathRoom.depth : 0))
      .replace('{gold}', String(Math.round(adv.carriedGold)));
    this.note(`${adv.name} ${line}`, 'death');
    if (killer && killer.name) this.note(`It was ${killer.name} that did it.`, 'death');
    if (adv.carriedGold > 0) this.note(`${Math.round(adv.carriedGold)} gold stays down here with them.`, 'bad');
    this.dead.push(adv);
    this.threat.add(3, 'the dungeon took one of yours');

    if (!this.living.length) this.finish('wiped');
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------

  setOrder(advs, order, point) {
    for (const adv of advs) {
      if (!adv.alive) continue;
      adv.order = order;
      adv.orderPoint = point ? { ...point } : null;
      adv.path = [];
      adv.goal = null;
      adv.fleeing = false;
      adv.restTimer = 0;
      if (order === 'focus') adv.order = 'explore';
    }
    if (order === 'retreat') this.note('Fall back! Everyone to the entrance.', 'bad');
    if (order === 'rest') this.note('The party stops to breathe. The dungeon does not.', 'plain');
  }

  focusTarget(advs, enemy) {
    for (const adv of advs) {
      if (!adv.alive) continue;
      adv.focusId = enemy ? enemy.id : null;
    }
    if (enemy) this.note(`Focus fire on ${enemy.name}.`, 'plain');
  }

  beginExtraction() {
    if (this.outcome) return;
    if (this.bossSlain) {
      this.finish('victory');
      return;
    }
    this.extracting = true;
    this.setOrder(this.living, 'retreat');
    this.note('Extraction called. Get to the ladder.', 'good');
  }

  cancelExtraction() {
    this.extracting = false;
    this.setOrder(this.living, 'explore');
    this.note('Extraction called off. Back into it.', 'plain');
  }

  markExtractReady(adv) {
    adv.atEntrance = true;
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  update(dt) {
    if (this.outcome || this.paused) return;
    this.time += dt;
    this.chronicle.tick(dt);

    const deepest = this.dungeon.deepestEntered();
    this.threat.tick(dt, { depth: deepest });

    // The timed draw is not worth a line in the chronicle — the hand shows it.
    this.deck.tick(dt);

    this.objectiveTimer -= dt;
    if (this.objectiveTimer <= 0) {
      this.objectiveTimer = OBJECTIVE_INTERVAL;
      this.partyObjective = choosePartyObjective(this);
    }

    for (const adv of this.party) updateAdventurer(adv, this, dt);
    for (const enemy of this.enemies) updateEnemy(enemy, this, dt);

    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.updateRooms(dt);

    if (this.extracting && this.living.length) {
      const home = key(this.entranceCell.x, this.entranceCell.y);
      if (this.living.every((a) => a.roomKey === home)) this.finish('extracted');
    }
    if (this.newBiomeFlash) {
      this.newBiomeFlash.t -= dt;
      if (this.newBiomeFlash.t <= 0) this.newBiomeFlash = null;
    }
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const target = p.side === 'party' ? this.enemyById(p.targetId) : this.partyById(p.targetId);
      if (target && dist(p.x, p.y, target.x, target.y) < 10) {
        const attacker = p.side === 'party' ? this.partyById(p.owner) : this.enemyById(p.owner);
        const res = applyDamage(attacker, target, p.damage, this, { element: p.element });
        if (res.dealt > 0 && p.onHit && Math.random() < (p.onHit.chance || 1)) {
          applyStatus(target, p.onHit.status, p.onHit.duration, p.onHit.power, attacker);
        }
        this.burst(p.x, p.y, 8, p.element === 'fire' ? '#ff9a3c' : '#a9d8ff');
        p.life = 0;
      }
      if (!target) p.life = Math.min(p.life, 0.3);
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  updateEffects(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.y += f.vy * dt;
      f.vy *= 0.94;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  updateRooms(dt) {
    for (const room of this.dungeon.rooms.values()) {
      if (room.dropT > 0) room.dropT = Math.max(0, room.dropT - dt * 1.8);
      if (!room.entered) continue;

      const biome = biomeOf(room.biome);
      if (biome && biome.aura && biome.aura.respawn && room.enemyIds.length === 0 && !room.cleared) {
        room.respawnTimer -= dt;
      }
      if (biome && biome.aura && biome.aura.respawn && room.cleared) {
        room.respawnTimer -= dt;
        if (room.respawnTimer <= 0) {
          room.respawnTimer = biome.aura.respawn;
          const occupied = this.living.some((a) => a.roomKey === room.key);
          if (occupied && this.rng.chance(0.6)) {
            const b = roomBounds(room.x, room.y);
            const foe = createEnemy(biome.spawn.type, this.rng.float(b.left + 16, b.right - 16), this.rng.float(b.top + 16, b.bottom - 16), room.key, {
              threat: this.threat.value,
              depth: room.depth,
            });
            this.addEnemy(foe, room);
            room.cleared = false;
            this.note(`More of them come out of the walls of the ${room.name}.`, 'bad');
          }
        }
      }

      // Biome auras that hurt or help whoever is standing in them.
      if (biome && biome.aura) {
        const aura = biome.aura;
        for (const adv of this.living) {
          if (adv.roomKey !== room.key) continue;
          if (aura.burnChance && this.rng.chance(aura.burnChance * dt)) {
            applyStatus(adv, 'burn', 3, 2, null);
          }
          if (aura.regen) healActor(adv, aura.regen * dt * 0.4, this, { silent: true });
        }
      }
      this.checkRoomCleared(room);
    }
  }

  checkRoomCleared(room) {
    const becameClear = this.dungeon.updateCleared(room);
    if (becameClear && !room.clearCredited) {
      room.clearCredited = true;
      const dealt = this.deck.drawOne();
      this.note(
        `The ${room.name} is done with. ${dealt ? `A card comes to hand: ${dealt.card.name}.` : 'Your hand is full.'}`,
        'good',
      );
      this.checkBiomeReward(room);
    }
  }

  checkBiomeReward(room) {
    if (!room.biome) return;
    const rooms = this.dungeon.roomsInBiome(room.biome);
    if (!rooms.every((r) => r.cleared)) return;
    // Tribute is paid once per expedition, tracked here rather than on the
    // shared biome data, which every run reads from.
    const biome = getBiome(room.biome);
    if (this.clearedBiomes.has(biome.id)) return;
    this.clearedBiomes.add(biome.id);

    const finder = this.living[0];
    if (!finder) return;
    finder.carriedGold += biome.reward.gold;
    this.note(`The ${biome.name} is yours, every room of it. ${biome.reward.gold} gold in tribute.`, 'biome');
    if (biome.reward.gear) {
      const pool = gearFor(finder.classId, biome.reward.grade || 'fine');
      if (pool.length) {
        const gear = this.rng.pick(pool);
        finder.carriedLoot.push(gear.id);
        this.note(`And ${gear.name}, which nobody argues about.`, 'loot');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Ending
  // -------------------------------------------------------------------------

  finish(outcome) {
    if (this.outcome) return;
    this.outcome = outcome;
    const survivors = this.living;
    const insurance = this.guild.insurance || 0.15;

    let gold = 0;
    const gear = [];
    if (outcome === 'wiped') {
      // Everything the party was carrying stays where it fell — bar what the
      // guild's standing arrangement with the local scavengers recovers.
      let lost = 0;
      for (const adv of this.dead) lost += adv.carriedGold;
      gold = Math.round(lost * insurance);
      this.note(`Nobody came back. The guild recovers ${gold} gold of ${Math.round(lost)}.`, 'death');
    } else {
      for (const adv of survivors) {
        gold += adv.carriedGold;
        gear.push(...adv.carriedLoot);
        adv.expeditions += 1;
        adv.goldEarned += adv.carriedGold;
        adv.carriedGold = 0;
        adv.carriedLoot = [];
        this.bark(adv, 'extract');
      }
      if (outcome === 'victory') {
        gold = Math.round(gold * 1.5);
        this.note('Cindervex is dead and the vault is yours. The guild will not shut up about it for a year.', 'boss');
      } else {
        this.note(`Out, with ${gold} gold and most of your people.`, 'good');
      }
    }

    this.results = {
      outcome,
      gold,
      gear,
      survivors,
      dead: this.dead,
      depth: this.dungeon.deepestEntered(),
      rooms: this.roomsPlaced,
      kills: this.kills,
      eliteKills: this.eliteKills,
      threat: Math.round(this.threat.value),
      biomes: [...new Set(this.dungeon.biomeIds.values())].map((id) => getBiome(id).name),
      duration: this.time,
      bossSlain: this.bossSlain,
      miniBossSlain: this.miniBossSlain,
      chronicle: this.chronicle.entries.slice(),
    };
    return this.results;
  }
}

const BOSS_FREE_PREFIXES = ['Scarred', 'Warbling', 'Overfed', 'Twice-Buried', 'Gilded', 'Unpleasant'];
