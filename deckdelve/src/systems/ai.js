// Adventurer and monster brains.
//
// The design rule: the player gives a posture, not instructions. Everything
// below decides where to walk, what to hit and when to run, and personality
// traits are allowed to overrule good sense — that is where the stories come
// from.

import { TRAITS } from '../data/traits.js';
import { dist, clamp } from '../core/util.js';
import {
  ROOM_PX, clampToRoom, findPath, key, roomCenter, waypointsAlong, worldToGrid,
} from './grid.js';
import { basicAttack, statusMods, tickCooldowns, tickStatuses, tryAbilities, tryMonsterAbilities } from './combat.js';

const ARRIVE = 6;
const INTERACT_TIME = 2.4;
const SEPARATION = 15;

/** Multiplicative trait fields (cohesion, lootSpeed…) fold with a product. */
function traitProduct(traitIds, field) {
  let out = 1;
  for (const id of traitIds || []) {
    const t = TRAITS[id];
    if (t && typeof t[field] === 'number') out *= t[field];
  }
  return out;
}

function traitAdd(traitIds, field) {
  let out = 0;
  for (const id of traitIds || []) {
    const t = TRAITS[id];
    if (t && typeof t[field] === 'number') out += t[field];
  }
  return out;
}

function hasT(adv, id) {
  return (adv.traits || []).includes(id);
}

/** True when another living adventurer has already called dibs on a spot. */
function heldByOther(spot, adv, world) {
  if (!spot.claimedBy || spot.claimedBy === adv.id) return false;
  const other = world.party.find((a) => a.id === spot.claimedBy);
  return !!(other && other.alive);
}

// ---------------------------------------------------------------------------
// Objective scoring — "what is worth walking to"
// ---------------------------------------------------------------------------

/**
 * Scores every room with unfinished business from one adventurer's point of
 * view. A Greedy rogue and a Cautious cleric genuinely disagree here.
 */
export function scoreObjectives(adv, world) {
  const dungeon = world.dungeon;
  const from = adv.cell;
  const scores = [];
  const lootPull = traitProduct(adv.traits, 'lootPriority') * (world.goldFever ? 1.5 : 1);
  const featurePull = traitProduct(adv.traits, 'featurePriority');
  const shrinePull = traitProduct(adv.traits, 'shrinePriority');
  const campPull = traitProduct(adv.traits, 'campPriority');
  const chargePull = traitProduct(adv.traits, 'chargeBias');
  const bossPull = traitProduct(adv.traits, 'bossBias');

  for (const room of dungeon.list()) {
    if (!room.reachable) continue;
    let value = 0;

    if (!room.entered) {
      // Curiosity. Nobody knows what is in there, which is the point.
      value += 12 + (adv.scout ? 5 : 0);
      if (room.tier >= 3) value += 6 * bossPull;
    } else {
      const business = dungeon.roomBusiness(room);
      if (room.enemyIds.length) value += 6 * chargePull;
      if (business.pendingLoot && !heldByOther(business.pendingLoot, adv, world)) value += 9 * lootPull;
      for (const f of business.pendingFeatures) {
        if (heldByOther(f, adv, world)) continue;
        if (f.id === 'shrine') value += 7 * shrinePull * featurePull;
        else if (f.id === 'campfire') value += 6 * campPull * featurePull;
        else if (f.id === 'tome' || f.id === 'puzzle' || f.id === 'still') value += 6 * featurePull;
        else value += 5 * featurePull;
      }
    }
    if (value <= 0) continue;

    const path = findPath(dungeon.rooms, from, room);
    if (!path) continue;
    const steps = path.length - 1;
    value -= steps * 2.4;

    if (hasT(adv, 'claustrophobic')) value -= room.depth * 2.2;
    if (hasT(adv, 'superstitious') && room.tags.includes('undead')) value -= 9;
    if (hasT(adv, 'cautious') && room.tier >= 2) value -= 5;
    if (room.key === world.partyObjective) value += 7 * traitProduct(adv.traits, 'cohesion');

    scores.push({ room, value, steps, path });
  }
  scores.sort((a, b) => b.value - a.value);
  return scores;
}

/** The party's shared idea of where to go next, recomputed a few times a second. */
export function choosePartyObjective(world) {
  const explorers = world.party.filter((a) => a.alive && a.order === 'explore');
  if (!explorers.length) return null;
  const tally = new Map();
  for (const adv of explorers) {
    const scores = scoreObjectives(adv, world);
    for (const s of scores.slice(0, 4)) {
      tally.set(s.room.key, (tally.get(s.room.key) || 0) + s.value);
    }
  }
  let best = null;
  let bestValue = -Infinity;
  for (const [k, v] of tally) {
    if (v > bestValue) {
      bestValue = v;
      best = k;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function setPath(adv, world, targetCell, kind) {
  const path = findPath(world.dungeon.rooms, adv.cell, targetCell);
  if (!path) {
    adv.path = [];
    adv.goal = null;
    return false;
  }
  adv.path = waypointsAlong(path).slice(1);
  adv.goal = key(targetCell.x, targetCell.y);
  adv.goalKind = kind;
  adv.pathVersion = world.graphVersion;
  return true;
}

function stepAlongPath(adv, world, dt, speed) {
  const next = adv.path[0];
  if (!next) return false;
  const dx = next.x - adv.x;
  const dy = next.y - adv.y;
  const len = Math.hypot(dx, dy);
  if (len < ARRIVE) {
    adv.path.shift();
    return true;
  }
  adv.x += (dx / len) * speed * dt;
  adv.y += (dy / len) * speed * dt;
  if (Math.abs(dx) > 2) adv.facing = dx > 0 ? 1 : -1;
  return true;
}

function moveToward(actor, x, y, speed, dt, stopAt = 0) {
  const dx = x - actor.x;
  const dy = y - actor.y;
  const len = Math.hypot(dx, dy);
  if (len <= stopAt || len < 0.5) return true;
  const step = Math.min(speed * dt, len - stopAt);
  actor.x += (dx / len) * step;
  actor.y += (dy / len) * step;
  if (Math.abs(dx) > 2) actor.facing = dx > 0 ? 1 : -1;
  return false;
}

/** Gentle shoving so a party of four does not occupy one pixel. */
function separate(actor, others, dt) {
  if (actor.state === 'interacting') return;
  let px = 0;
  let py = 0;
  for (const o of others) {
    if (o === actor || !o.alive) continue;
    if (o.state === 'interacting') continue;
    const d = dist(actor.x, actor.y, o.x, o.y);
    if (d > SEPARATION || d < 0.01) continue;
    const push = (SEPARATION - d) / SEPARATION;
    px += ((actor.x - o.x) / d) * push;
    py += ((actor.y - o.y) / d) * push;
  }
  actor.x += px * 26 * dt;
  actor.y += py * 26 * dt;
}

/** Keeps a body inside the room it is standing in, doorways excepted. */
function confine(actor, world) {
  const g = worldToGrid(actor.x, actor.y);
  const room = world.dungeon.get(g.x, g.y);
  if (!room) {
    // Walked off the edge of the world somehow — put them back in their room.
    const home = world.dungeon.rooms.get(actor.roomKey);
    if (home) {
      const c = roomCenter(home.x, home.y);
      actor.x = c.x;
      actor.y = c.y;
    }
    return;
  }
  const fixed = clampToRoom(room, g.x, g.y, actor.x, actor.y, 5);
  actor.x = fixed.x;
  actor.y = fixed.y;
  if (room.key !== actor.roomKey) {
    actor.lastRoomKey = actor.roomKey;
    actor.roomKey = room.key;
    actor.cell = { x: g.x, y: g.y };
    if (actor.side === 'party') world.onAdventurerEnteredRoom(actor, room);
  } else {
    actor.cell = { x: g.x, y: g.y };
  }
}

/**
 * Claims a chest or a shrine for one adventurer. Without this, four people
 * converge on the same 10-pixel circle, shove each other out of it, and the
 * expedition quietly stops happening.
 */
function claimSpot(adv, world, business) {
  const spots = [business.pendingLoot, ...business.pendingFeatures].filter(Boolean);
  for (const spot of spots) {
    const holder = spot.claimedBy;
    if (!holder || holder === adv.id) {
      spot.claimedBy = adv.id;
      return spot;
    }
    const other = world.party.find((a) => a.id === holder);
    if (!other || !other.alive || other.roomKey !== adv.roomKey) {
      spot.claimedBy = adv.id;
      return spot;
    }
  }
  return null;
}

const REACH = 12;

/** Walks to a spot and works at it; returns false when it is somebody else's. */
function workSpot(adv, world, dt, speed, room, business) {
  const spot = claimSpot(adv, world, business);
  if (!spot) {
    adv.interactTimer = 0;
    return false;
  }
  if (dist(adv.x, adv.y, spot.x, spot.y) <= REACH) {
    adv.state = 'interacting';
    adv.interactTimer += dt * traitProduct(adv.traits, 'lootSpeed');
    if (adv.interactTimer >= INTERACT_TIME) {
      adv.interactTimer = 0;
      if (spot === business.pendingLoot) world.takeLoot(adv, room);
      else world.fireFeature(adv, room, spot);
    }
  } else {
    moveToward(adv, spot.x, spot.y, speed, dt, 0);
    adv.state = 'moving';
  }
  return true;
}

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

function pickTarget(adv, world) {
  if (adv.focusId) {
    const focused = world.enemyById(adv.focusId);
    if (focused && focused.alive) return focused;
    adv.focusId = null;
  }
  const reach = adv.ranged ? adv.attackRange + 60 : 170;
  const foes = world.hostilesNear(adv, reach);
  if (!foes.length) return null;

  // Loyal adventurers go after whatever is chewing on a hurt friend.
  if (hasT(adv, 'loyal')) {
    const hurt = world.party.find((a) => a.alive && a !== adv && a.hp / a.maxHp < 0.45);
    if (hurt) {
      const attacker = foes.find((f) => f.targetId === hurt.id);
      if (attacker) return attacker;
    }
  }
  if (hasT(adv, 'vainglorious')) {
    const boss = foes.find((f) => f.boss || f.elite);
    if (boss) return boss;
  }
  if (adv.healer || adv.ranged) {
    // Squishies shoot whatever is closest to killing something.
    const weakest = foes.slice().sort((a, b) => a.hp - b.hp)[0];
    if (weakest && weakest.hp < weakest.maxHp * 0.4) return weakest;
  }
  return foes.slice().sort((a, b) => dist(adv.x, adv.y, a.x, a.y) - dist(adv.x, adv.y, b.x, b.y))[0];
}

// ---------------------------------------------------------------------------
// Adventurer update
// ---------------------------------------------------------------------------

export function updateAdventurer(adv, world, dt) {
  if (!adv.alive) return;

  tickStatuses(adv, dt, world);
  tickCooldowns(adv, dt);
  if (!adv.alive) return;
  adv.attackTimer -= dt;
  adv.swing = Math.max(0, adv.swing - dt);
  adv.hitFlash = Math.max(0, adv.hitFlash - dt);
  adv.stateTime += dt;
  adv.barkTimer -= dt;

  const mods = statusMods(adv);
  if (mods.stunned) {
    adv.state = 'stunned';
    confine(adv, world);
    return;
  }

  const room = world.dungeon.rooms.get(adv.roomKey);

  // Catching your breath. Slow, automatic, and the reason a party can survive
  // more than one bad room — but only in a room with nothing left in it.
  if (adv.hp < adv.maxHp && !world.hostilesNear(adv, 200).length) {
    adv.hp = Math.min(adv.maxHp, adv.hp + 0.9 * (world.roomRegen(adv.roomKey) || 1) * dt);
  }
  const speed = adv.speed * mods.speed * (world.roomSlow(adv.roomKey) || 1);
  const hpFrac = adv.hp / adv.maxHp;

  // --- nerve check -------------------------------------------------------
  const nearbyFoes = world.hostilesNear(adv, 190);
  if (adv.order === 'explore' || adv.order === 'interact') {
    if (!adv.fleeing && hpFrac < adv.fleeThreshold && nearbyFoes.length) {
      adv.fleeing = true;
      if (world.signal) world.signal('flee', { name: adv.name });
      world.bark(adv, 'flee');
      world.note(`${adv.name} has had enough of this room.`, 'bad');
    } else if (adv.fleeing && (hpFrac > adv.fleeThreshold + 0.22 || !nearbyFoes.length)) {
      adv.fleeing = false;
    }
  } else {
    adv.fleeing = false;
  }

  if (mods.feared) adv.fleeing = true;

  // --- orders ------------------------------------------------------------
  switch (adv.order) {
    case 'hold':
      holdBehaviour(adv, world, dt, speed);
      break;
    case 'rally':
      rallyBehaviour(adv, world, dt, speed);
      break;
    case 'retreat':
      retreatBehaviour(adv, world, dt, speed);
      break;
    case 'rest':
      restBehaviour(adv, world, dt, speed);
      break;
    case 'interact':
      interactBehaviour(adv, world, dt, speed, room);
      break;
    default:
      if (adv.fleeing) retreatBehaviour(adv, world, dt, speed, true);
      else exploreBehaviour(adv, world, dt, speed, room);
      break;
  }

  separate(adv, world.party, dt);
  confine(adv, world);

  if (adv.barkTimer <= 0) {
    adv.barkTimer = 14 + Math.random() * 18;
    if (nearbyFoes.length) world.bark(adv, 'fight');
    else if (hpFrac < 0.4) world.bark(adv, 'hurt');
  }
}

/** Shared: attack whatever is in reach. Returns true if busy fighting. */
function engage(adv, world, dt, speed, options = {}) {
  const target = pickTarget(adv, world);
  adv.targetId = target ? target.id : null;
  if (!target) return false;

  tryAbilities(adv, world);

  const range = adv.attackRange;
  const d = dist(adv.x, adv.y, target.x, target.y);
  if (d > range) {
    if (options.stationary) return true;
    // Casters keep their distance; everyone else closes.
    moveToward(adv, target.x, target.y, speed, dt, range * 0.75);
  } else if (adv.ranged && d < range * 0.45 && !options.stationary) {
    moveToward(adv, adv.x * 2 - target.x, adv.y * 2 - target.y, speed * 0.7, dt);
  }

  if (d <= range + 4 && adv.attackTimer <= 0) {
    basicAttack(adv, target, world);
    adv.attackTimer = adv.attackTime;
  }
  adv.state = 'fighting';
  return true;
}

function exploreBehaviour(adv, world, dt, speed, room) {
  // Fight first if anything in this room is hostile and close.
  if (engage(adv, world, dt, speed)) return;

  // Loyal adventurers close on a badly hurt friend even without a fight.
  if (hasT(adv, 'loyal')) {
    const hurt = world.party.find((a) => a.alive && a !== adv && a.hp / a.maxHp < 0.4);
    if (hurt && dist(adv.x, adv.y, hurt.x, hurt.y) > 40) {
      if (hurt.roomKey === adv.roomKey) {
        moveToward(adv, hurt.x, hurt.y, speed, dt, 26);
        adv.state = 'guarding';
        return;
      }
    }
  }

  // Anything left to do right here?
  if (room && room.entered) {
    const business = world.dungeon.roomBusiness(room);
    const cautiousWait =
      hasT(adv, 'cautious') && world.party.filter((a) => a.alive && a.roomKey === adv.roomKey).length < 2;
    if (!cautiousWait && (business.pendingLoot || business.pendingFeatures.length)) {
      if (workSpot(adv, world, dt, speed, room, business)) return;
    }
  }

  // Otherwise, pick somewhere with unfinished business and walk there.
  const needNewGoal =
    !adv.goal ||
    adv.pathVersion !== world.graphVersion ||
    (!adv.path.length && adv.goal !== adv.roomKey) ||
    (adv.goal === adv.roomKey && !world.roomHasBusiness(adv.goal));

  if (needNewGoal) {
    const scores = scoreObjectives(adv, world);
    if (scores.length) {
      setPath(adv, world, scores[0].room, 'explore');
    } else {
      adv.goal = null;
      adv.path = [];
    }
  }

  if (adv.path.length) {
    stepAlongPath(adv, world, dt, speed);
    adv.state = 'moving';
  } else {
    // Nothing to do: mill about near the party, waiting for a new card.
    const anchor = world.partyCentroid();
    if (dist(adv.x, adv.y, anchor.x, anchor.y) > 42) moveToward(adv, anchor.x, anchor.y, speed * 0.7, dt, 30);
    adv.state = 'idle';
  }
}

function holdBehaviour(adv, world, dt, speed) {
  if (!adv.orderPoint) adv.orderPoint = { x: adv.x, y: adv.y };
  const anchor = adv.orderPoint;
  if (engage(adv, world, dt, speed, { stationary: dist(adv.x, adv.y, anchor.x, anchor.y) > 34 })) {
    if (dist(adv.x, adv.y, anchor.x, anchor.y) > 46) moveToward(adv, anchor.x, anchor.y, speed, dt, 8);
    return;
  }
  if (moveToward(adv, anchor.x, anchor.y, speed, dt, 6)) adv.state = 'holding';
  else adv.state = 'moving';
}

function rallyBehaviour(adv, world, dt, speed) {
  const point = adv.orderPoint;
  if (!point) {
    adv.order = 'explore';
    return;
  }
  const cell = worldToGrid(point.x, point.y);
  const goalKey = key(cell.x, cell.y);
  if (adv.roomKey !== goalKey) {
    if (!adv.goal || adv.goal !== goalKey || adv.pathVersion !== world.graphVersion) {
      if (!setPath(adv, world, cell, 'rally')) {
        adv.order = 'explore';
        return;
      }
    }
    // Fight only what actively blocks the way.
    const foes = world.hostilesNear(adv, adv.attackRange + 12);
    if (foes.length) engage(adv, world, dt, speed, { stationary: true });
    stepAlongPath(adv, world, dt, speed);
    adv.state = 'moving';
    return;
  }
  if (moveToward(adv, point.x, point.y, speed, dt, 10)) {
    adv.order = 'hold';
    adv.orderPoint = { x: point.x, y: point.y };
    adv.state = 'holding';
  } else {
    engage(adv, world, dt, speed, { stationary: true });
    adv.state = 'moving';
  }
}

function retreatBehaviour(adv, world, dt, speed, fleeing = false) {
  const entrance = world.entranceCell;
  if (adv.roomKey === key(entrance.x, entrance.y)) {
    const c = roomCenter(entrance.x, entrance.y);
    moveToward(adv, c.x + (adv.id.length % 5) * 6 - 12, c.y + 18, speed, dt, 8);
    adv.state = fleeing ? 'fleeing' : 'waiting';
    if (!fleeing) world.markExtractReady(adv);
    return;
  }
  if (!adv.path.length || adv.goalKind !== 'retreat' || adv.pathVersion !== world.graphVersion) {
    setPath(adv, world, entrance, 'retreat');
  }
  // Swing at anything already in your face, but do not stop for it.
  const foes = world.hostilesNear(adv, adv.attackRange + 6);
  if (foes.length && adv.attackTimer <= 0) {
    basicAttack(adv, foes[0], world);
    adv.attackTimer = adv.attackTime;
  }
  stepAlongPath(adv, world, dt, speed * 1.12);
  adv.state = fleeing ? 'fleeing' : 'retreating';
}

function restBehaviour(adv, world, dt, speed) {
  const foes = world.hostilesNear(adv, 150);
  if (foes.length) {
    engage(adv, world, dt, speed);
    return;
  }
  adv.state = 'resting';
  adv.restTimer += dt;
  const rate = 2.6 * (1 + traitAdd(adv.traits, 'restBonus')) * (world.roomRegen(adv.roomKey) || 1);
  adv.hp = Math.min(adv.maxHp, adv.hp + rate * dt);
  if (adv.restTimer > 6) {
    adv.restTimer = 0;
    world.bark(adv, 'rest');
  }
}

function interactBehaviour(adv, world, dt, speed, room) {
  if (!room) return;
  const business = world.dungeon.roomBusiness(room);
  if (!business.pendingLoot && !business.pendingFeatures.length) {
    adv.order = 'explore';
    return;
  }
  if (!workSpot(adv, world, dt, speed, room, business)) adv.state = 'idle';
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

export function updateEnemy(enemy, world, dt) {
  if (!enemy.alive) return;
  tickStatuses(enemy, dt, world);
  if (!enemy.alive) return;
  enemy.attackTimer -= dt;
  enemy.swing = Math.max(0, enemy.swing - dt);
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

  const mods = statusMods(enemy);
  if (mods.stunned) return;
  const speed = enemy.speed * mods.speed;

  tryMonsterAbilities(enemy, world, dt);

  let target = enemy.targetId ? world.partyById(enemy.targetId) : null;
  if (target && (!target.alive || !world.canEngage(enemy, target) ||
      dist(enemy.x, enemy.y, target.x, target.y) > enemy.aggro * 1.6)) {
    target = null;
  }
  if (!target) {
    const candidates = world.hostilesNear(enemy, enemy.aggro);
    target = candidates.sort((a, b) => dist(enemy.x, enemy.y, a.x, a.y) - dist(enemy.x, enemy.y, b.x, b.y))[0] || null;
    enemy.targetId = target ? target.id : null;
  }

  if (!target) {
    enemy.state = 'idle';
    // Drift home so a room does not slowly empty itself into a doorway.
    if (dist(enemy.x, enemy.y, enemy.homeX, enemy.homeY) > 10) {
      moveToward(enemy, enemy.homeX, enemy.homeY, speed * 0.5, dt, 6);
    }
  } else {
    enemy.state = 'hunting';
    const d = dist(enemy.x, enemy.y, target.x, target.y);
    if (d > enemy.attackRange) moveToward(enemy, target.x, target.y, speed, dt, enemy.attackRange * 0.8);
    if (d <= enemy.attackRange + 4 && enemy.attackTimer <= 0) {
      basicAttack(enemy, target, world);
      enemy.attackTimer = enemy.attackTime;
    }
  }

  // Monsters keep to their room. It is their room.
  const home = world.dungeon.rooms.get(enemy.roomKey);
  if (home) {
    const fixed = clampToRoom(home, home.x, home.y, enemy.x, enemy.y, 6);
    const b = ROOM_PX;
    enemy.x = clamp(fixed.x, home.x * b + 10, home.x * b + b - 10);
    enemy.y = clamp(fixed.y, home.y * b + 10, home.y * b + b - 10);
  }
}

