// Runtime map handling: normalising the ASCII grids, resolving warp markers
// into coordinates, collision, and rolling wild encounters.

import { MAPS, getMap } from '../data/maps.js';
import { TILES, tileAt } from './tiles.js';
import { DEX, speciesInHabitat, getSpecies } from '../data/species.js';
import { createWild } from '../systems/monster.js';
import { clamp } from '../core/util.js';

const BORDER = { indoor: '|', cave: '%', outdoor: '#' };

const prepared = new Set();

/**
 * Normalises a map in place: pads rows to a common width, extracts warp
 * markers into coordinates, and nudges NPCs off solid tiles.
 */
export function prepareMap(id) {
  const map = getMap(id);
  if (!map || prepared.has(id)) return map;

  const border = map.indoor ? BORDER.indoor : map.cave ? BORDER.cave : BORDER.outdoor;
  const width = map.tiles.reduce((w, row) => Math.max(w, row.length), 0);
  map.tiles = map.tiles.map((row) => row.padEnd(width, border));
  map.width = width;
  map.height = map.tiles.length;

  // Pull warp markers (digits) out of the grid.
  map.warpPoints = {};
  const rows = map.tiles.map((row) => row.split(''));
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch >= '0' && ch <= '9') {
        const marker = Number(ch);
        const def = map.warps && map.warps[marker];
        rows[y][x] = def && def.look ? def.look : map.indoor ? 'D' : 'p';
        if (!map.warpPoints[marker]) map.warpPoints[marker] = [];
        map.warpPoints[marker].push({ x, y });
      }
    }
  }
  map.tiles = rows.map((row) => row.join(''));

  // Index warps by tile position for quick lookup while walking.
  map.warpAt = {};
  for (const marker in map.warpPoints) {
    const def = map.warps[marker];
    if (!def) continue;
    for (const point of map.warpPoints[marker]) {
      map.warpAt[`${point.x},${point.y}`] = { ...def, marker: Number(marker) };
    }
  }

  // Keep NPCs standing somewhere legal.
  for (const npc of map.npcs || []) {
    if (isBlocked(map, npc.x, npc.y)) {
      const spot = nearestOpen(map, npc.x, npc.y);
      if (spot) {
        npc.x = spot.x;
        npc.y = spot.y;
      }
    }
  }

  // Sign tiles are solid and interactable; index them by position.
  map.signAt = {};
  for (const sign of map.signs || []) map.signAt[`${sign.x},${sign.y}`] = sign;

  prepared.add(id);
  return map;
}

export function prepareAllMaps() {
  for (const id in MAPS) prepareMap(id);
  return MAPS;
}

function isBlocked(map, x, y) {
  const tile = tileAt(map, x, y);
  return !tile || tile.solid;
}

function nearestOpen(map, x, y) {
  for (let radius = 1; radius <= 4; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isBlocked(map, nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

/** Warp entry standing on a tile, if any. */
export function warpAt(map, x, y) {
  return map.warpAt ? map.warpAt[`${x},${y}`] || null : null;
}

/** Where the player should appear when arriving through `marker`. */
export function arrivalPoint(map, marker) {
  prepareMap(map.id);
  const points = map.warpPoints && map.warpPoints[marker];
  if (points && points.length) {
    // Land on the first marker tile; the caller nudges the player forward.
    return { x: points[0].x, y: points[0].y };
  }
  return { x: map.spawn ? map.spawn.x : 1, y: map.spawn ? map.spawn.y : 1 };
}

/**
 * Movement check for the player or an NPC.
 * Returns { ok, reason, ledge } — ledges may be hopped down but not climbed.
 */
export function canMoveTo(map, x, y, dir, occupancy = null) {
  if (x < 0 || y < 0 || y >= map.height || x >= map.width) return { ok: false, reason: 'edge' };
  const tile = tileAt(map, x, y);
  if (!tile) return { ok: false, reason: 'edge' };
  if (occupancy && occupancy(`${x},${y}`)) return { ok: false, reason: 'occupied' };
  if (tile.ledge) {
    return dir === tile.ledge ? { ok: true, ledge: true } : { ok: false, reason: 'ledge' };
  }
  if (tile.water) return { ok: false, reason: 'water', water: true };
  if (tile.solid) return { ok: false, reason: 'solid' };
  return { ok: true };
}

// ── Encounters ─────────────────────────────────────────────────────────────

const RARITY_WEIGHT = {
  common: 26,
  uncommon: 12,
  rare: 4,
  starter: 1,
  legendary: 0,
  mythic: 0,
};

/**
 * Builds the weighted pool for one encounter table.
 * Featured species are pinned; the rest is drawn from the habitat tags so the
 * procedural roster shows up in the right places.
 */
export function encounterPool(map, tableName) {
  const table = map.encounters && map.encounters[tableName];
  if (!table) return null;
  const cacheKey = `${map.id}:${tableName}`;
  if (!encounterPool.cache) encounterPool.cache = {};
  if (encounterPool.cache[cacheKey]) return encounterPool.cache[cacheKey];

  const entries = [];
  for (const feature of table.featured || []) {
    if (!DEX[feature.species] || !feature.weight) continue;
    entries.push({ species: feature.species, weight: feature.weight });
  }
  for (const tag of table.habitats || []) {
    for (const species of speciesInHabitat(tag)) {
      if (species.legendary) continue;
      if (entries.some((e) => e.species === species.id)) continue;
      // Prefer unevolved forms in the wild; fully evolved forms stay rare.
      const stagePenalty = species.stage === 1 ? 1 : species.stage === 2 ? 0.45 : 0.15;
      const weight = (RARITY_WEIGHT[species.rarity] || 8) * stagePenalty;
      if (weight <= 0) continue;
      entries.push({ species: species.id, weight });
    }
  }
  const pool = { entries, levels: table.levels || [3, 6] };
  encounterPool.cache[cacheKey] = pool;
  return pool;
}

/** Rolls one wild creature for a tile's encounter table. */
export function rollEncounter(map, tableName, rng, opts = {}) {
  const pool = encounterPool(map, tableName);
  if (!pool || !pool.entries.length) return null;
  const list = pool.entries.map((e) => e.species);
  const weights = pool.entries.map((e) => {
    let w = e.weight;
    if (opts.rareBonus && (getSpecies(e.species).rarity === 'rare')) w *= opts.rareBonus;
    return w;
  });
  const speciesId = rng.weighted(list, weights);
  let [min, max] = pool.levels;
  if (opts.levelShift) {
    min += opts.levelShift;
    max += opts.levelShift;
  }
  const level = clamp(rng.int(min, max), 2, 100);
  return createWild(speciesId, level, rng);
}

/** Chance per step of running into something on an encounter tile. */
export function encounterChance(tile, modifiers = {}) {
  if (!tile || !tile.encounter) return 0;
  let base = tile.encounter === 'grass_rare' ? 0.16 : tile.encounter === 'water' ? 0.1 : 0.12;
  if (modifiers.lure) base *= 2;
  if (modifiers.abilityRate) base *= modifiers.abilityRate;
  return clamp(base, 0, 0.6);
}

/** The environment tag used by capture orbs and battle backdrops. */
export function environmentOf(map, tile) {
  if (map.cave) return 'cave';
  if (tile && tile.water) return 'water';
  if (map.indoor) return 'indoor';
  return 'grass';
}

export { getMap, MAPS };
