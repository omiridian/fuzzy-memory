// The dungeon itself: a grid of placed room cards, what is hidden inside each
// one, and the fog that keeps it hidden until somebody walks in.

import { ENTRANCE, SIDES, rotateDoors, getCard } from '../data/cards.js';
import { GRADES, TREASURE_NAMES } from '../data/loot.js';
import { GRADE_ORDER, gearFor } from '../data/equipment.js';
import { detectBiomes, biomeOf } from './biomes.js';
import { canPlace, depthMap, key, roomBounds, roomCenter, worldToGrid } from './grid.js';

/** Features on a card map onto the event that fires when somebody pokes them. */
const FEATURE_EVENT = {
  shrine: 'shrine_offer',
  campfire: 'campfire',
  ore_seam: 'ore_seam',
  tome: 'tome',
  rack: 'rack',
  hoard: 'hoard',
  puzzle: 'puzzle',
  deep_water: 'deep_water',
  fungus_patch: 'fungus_patch',
  anvil: 'anvil',
  still: 'still',
};

const FEATURE_LABEL = {
  shrine: 'the basin',
  campfire: 'the cold camp',
  ore_seam: 'the ore seam',
  tome: 'the shelves',
  rack: 'the weapon racks',
  hoard: 'the hoard',
  puzzle: 'the nine dials',
  deep_water: 'the black water',
  fungus_patch: 'the mushroom beds',
  anvil: 'the anvil',
  still: "the alchemist's bench",
  exit: 'the rope ladder',
};

let roomSerial = 0;

function makeRoom(card, gx, gy, rotation, rng) {
  roomSerial += 1;
  return {
    uid: `room_${roomSerial}`,
    key: key(gx, gy),
    x: gx,
    y: gy,
    card: card.id,
    name: card.name,
    tags: card.tags.slice(),
    doors: rotateDoors(card.doors, rotation),
    rotation,
    floor: card.floor,
    decor: card.decor,
    tier: card.tier || 0,
    light: card.light || 1,
    blurb: card.blurb,
    discovery: card.discovery,
    depth: 0,
    biome: null,
    // Fog: placed rooms show their outline; contents stay secret until entered.
    placed: true,
    scouted: false,
    entered: false,
    cleared: false,
    clearCredited: false,
    enemyIds: [],
    spawned: false,
    plan: card.contents || {},
    features: [],
    loot: null,
    hazard: card.contents && card.contents.hazard ? card.contents.hazard : null,
    hazardArmed: !!(card.contents && card.contents.hazard),
    respawnTimer: 0,
    dropT: 0,
    seed: rng ? rng.int(0, 0xffffff) : 0,
    props: [],
  };
}

/** Scatter a few decorative props so no two rooms of a kind look identical. */
function generateProps(room, rng) {
  const b = roomBounds(room.x, room.y);
  const count = 4 + rng.int(0, 5);
  const props = [];
  for (let i = 0; i < count; i++) {
    const px = rng.float(b.left + 8, b.right - 8);
    const py = rng.float(b.top + 8, b.bottom - 8);
    const c = roomCenter(room.x, room.y);
    // keep the middle walkable and readable
    if (Math.abs(px - c.x) < 22 && Math.abs(py - c.y) < 22) continue;
    props.push({ x: px, y: py, r: rng.float(3, 7), v: rng.int(0, 3), a: rng.float(0, Math.PI * 2) });
  }
  room.props = props;
}

export class Dungeon {
  constructor(rng) {
    this.rng = rng;
    this.rooms = new Map();
    this.biomeIds = new Map();
    this.knownBiomes = new Set();
    this.origin = { x: 0, y: 0 };
    this.placeEntrance();
  }

  placeEntrance() {
    const room = makeRoom(ENTRANCE, 0, 0, 0, this.rng);
    room.entered = true;
    room.scouted = true;
    room.cleared = true;
    room.clearCredited = true;
    room.spawned = true;
    room.isEntrance = true;
    room.features = [{ id: 'exit', eventId: null, label: FEATURE_LABEL.exit, used: false, ...roomCenter(0, 0) }];
    generateProps(room, this.rng);
    this.rooms.set(room.key, room);
    this.recompute();
  }

  get(gx, gy) {
    return this.rooms.get(key(gx, gy)) || null;
  }

  atWorld(x, y) {
    const g = worldToGrid(x, y);
    return this.get(g.x, g.y);
  }

  /** Every placed room, in placement order. */
  list() {
    return [...this.rooms.values()];
  }

  canPlace(gx, gy, doors) {
    return canPlace(this.rooms, gx, gy, doors);
  }

  /**
   * Drops a card onto the grid. Returns the new room, or null if the placement
   * was illegal — callers are expected to have checked first.
   */
  place(cardId, gx, gy, rotation = 0) {
    const card = getCard(cardId);
    const doors = rotateDoors(card.doors, rotation);
    if (!this.canPlace(gx, gy, doors).ok) return null;
    const room = makeRoom(card, gx, gy, rotation, this.rng);
    generateProps(room, this.rng);
    room.dropT = 1;
    this.rooms.set(room.key, room);
    this.recompute();
    return room;
  }

  /** Depth and biomes, recomputed after any change to the graph. */
  recompute() {
    const depth = depthMap(this.rooms, this.origin);
    for (const room of this.rooms.values()) {
      const d = depth.get(room.key);
      room.depth = d === undefined ? 99 : d;
      room.reachable = d !== undefined;
    }
    this.biomeIds = detectBiomes(this.rooms);
    for (const room of this.rooms.values()) {
      room.biome = this.biomeIds.get(room.key) || null;
    }
  }

  /** Biomes that exist now and had not been announced yet. */
  takeNewBiomes() {
    const fresh = [];
    for (const id of new Set(this.biomeIds.values())) {
      if (this.knownBiomes.has(id)) continue;
      this.knownBiomes.add(id);
      fresh.push(biomeOf(id));
    }
    return fresh;
  }

  /** Rooms in a given biome. */
  roomsInBiome(biomeId) {
    return this.list().filter((r) => r.biome === biomeId);
  }

  /** The deepest room anybody has actually stood in. */
  deepestEntered() {
    let best = 0;
    for (const room of this.rooms.values()) {
      if (room.entered && room.reachable) best = Math.max(best, room.depth);
    }
    return best;
  }

  /**
   * Rolls what is actually in a room. Called the moment somebody walks in, so
   * Threat at the time of entry — not at the time of placement — decides how bad
   * it is. Returns a plan the expedition turns into live actors.
   */
  reveal(room, context) {
    if (room.spawned) return null;
    room.spawned = true;
    const rng = this.rng;
    const threat = context.threat || 0;
    const depth = room.depth;
    const biome = biomeOf(room.biome);

    const spawns = [];
    const plan = room.plan || {};
    for (const spec of plan.enemies || []) {
      if (spec.chance !== undefined && !rng.chance(spec.chance)) continue;
      const extra = Math.floor(depth / 4) + (threat > 55 ? 1 : 0);
      const count = rng.int(spec.count[0], spec.count[1]) + extra;
      for (let i = 0; i < count; i++) spawns.push({ type: spec.type });
    }
    if (biome && biome.spawn) {
      const count = rng.int(biome.spawn.count[0], biome.spawn.count[1]);
      for (let i = 0; i < count; i++) spawns.push({ type: biome.spawn.type, fromBiome: true });
    }

    // Elites: rarer up top, common once the dungeon is paying attention — but
    // not the majority of a room. They carry both an HP and a damage
    // multiplier, so this curve compounds with the Threat scaling below it and
    // gets away from you quickly if it is allowed to.
    const eliteChance = Math.min(0.3, 0.02 + threat * 0.0024 + depth * 0.009 +
      (biome && biome.aura && biome.aura.eliteChance ? biome.aura.eliteChance : 0));
    for (const s of spawns) {
      if (!plan.boss && rng.chance(eliteChance)) s.elite = true;
    }

    const boss = plan.boss || null;

    room.features = this.rollFeatures(room);
    room.loot = this.rollLoot(room, context);

    return { spawns, boss };
  }

  rollFeatures(room) {
    const out = [];
    const plan = room.plan || {};
    const b = roomBounds(room.x, room.y);
    const spots = [
      { x: (b.left + b.right) / 2, y: b.top + 22 },
      { x: b.left + 24, y: (b.top + b.bottom) / 2 },
      { x: b.right - 24, y: b.bottom - 24 },
    ];
    let i = 0;
    if (plan.feature) {
      out.push({
        id: plan.feature,
        eventId: FEATURE_EVENT[plan.feature] || null,
        label: FEATURE_LABEL[plan.feature] || plan.feature,
        used: false,
        ...spots[i++ % spots.length],
      });
    }
    if (plan.event) {
      out.push({
        id: plan.event,
        eventId: plan.event,
        label: 'something out of place',
        used: false,
        ...spots[i++ % spots.length],
      });
    }
    return out;
  }

  rollLoot(room, context) {
    const plan = room.plan || {};
    const spec = plan.loot;
    if (!spec) return null;
    const rng = this.rng;
    if (spec.chance !== undefined && !rng.chance(spec.chance)) return null;

    const biome = biomeOf(room.biome);
    let gradeIndex = GRADE_ORDER.indexOf(spec.grade || 'petty');
    // Depth and Threat push loot up the ladder; so does standing in a biome.
    if (rng.chance(Math.min(0.6, room.depth * 0.06 + (context.threat || 0) * 0.004))) gradeIndex += 1;
    if (biome && biome.reward && biome.reward.grade) {
      gradeIndex = Math.max(gradeIndex, GRADE_ORDER.indexOf(biome.reward.grade) - 1);
    }
    const grade = GRADE_ORDER[Math.min(GRADE_ORDER.length - 1, Math.max(0, gradeIndex))];
    const table = GRADES[grade];

    const rolls = spec.rolls || 1;
    let gold = 0;
    for (let i = 0; i < rolls; i++) gold += rng.int(table.gold[0], table.gold[1]);
    gold = Math.round(gold * (1 + room.depth * 0.08) * (biome && biome.aura && biome.aura.goldMult ? biome.aura.goldMult : 1));

    let gearId = null;
    if (spec.gear || rng.chance(table.gearChance)) {
      const pool = gearFor(context.classHint || 'fighter', grade);
      const anyPool = gearFor(null, grade);
      const chosen = rng.chance(0.5) && pool.length ? pool : anyPool;
      if (chosen.length) gearId = rng.pick(chosen).id;
    }

    const b = roomBounds(room.x, room.y);
    return {
      gold,
      gearId,
      grade,
      name: rng.pick(TREASURE_NAMES[grade] || TREASURE_NAMES.petty),
      taken: false,
      x: (b.left + b.right) / 2 + rng.float(-26, 26),
      y: (b.top + b.bottom) / 2 + rng.float(10, 34),
    };
  }

  /** Everything the party has not yet finished with in this room. */
  roomBusiness(room) {
    const pendingFeatures = room.features.filter((f) => !f.used && f.eventId);
    const pendingLoot = room.loot && !room.loot.taken ? room.loot : null;
    return { pendingFeatures, pendingLoot };
  }

  /** A room is cleared once nothing in it is hostile and nothing is left to take. */
  updateCleared(room) {
    if (!room.entered || !room.spawned) return false;
    const { pendingFeatures, pendingLoot } = this.roomBusiness(room);
    const done = room.enemyIds.length === 0 && !pendingFeatures.length && !pendingLoot;
    if (done && !room.cleared) {
      room.cleared = true;
      return true;
    }
    if (!done) room.cleared = false;
    return false;
  }

  /** Cards whose placement would still be legal somewhere on the board. */
  hasAnyPlacement(doorMasks) {
    for (const mask of doorMasks) {
      for (const room of this.rooms.values()) {
        for (let side = 0; side < 4; side++) {
          const nx = room.x + SIDES[side].dx;
          const ny = room.y + SIDES[side].dy;
          if (this.rooms.has(key(nx, ny))) continue;
          if (canPlace(this.rooms, nx, ny, mask).ok) return true;
        }
      }
    }
    return false;
  }
}

export { FEATURE_LABEL };
