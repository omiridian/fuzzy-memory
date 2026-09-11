// Biome detection: the bit that makes room placement a decision rather than a
// chore. Recipes are matched against clumps of rooms that are actually joined
// by doors, so two crypts on opposite sides of the map are just two crypts.

import { BIOMES, BIOME_BY_ID } from '../data/biomes.js';
import { key, linkedNeighbors } from './grid.js';

const byPriority = [...BIOMES].sort((a, b) => (b.priority || 0) - (a.priority || 0));

/** Grows a connected clump from `seed` that satisfies a card recipe. */
function matchCardRecipe(rooms, seedKey, recipe, assigned) {
  const seed = rooms.get(seedKey);
  const need = { ...recipe };
  if (!need[seed.card]) return null;

  const chosen = [seedKey];
  need[seed.card] -= 1;
  if (need[seed.card] === 0) delete need[seed.card];

  const frontier = new Map();
  const extend = (k) => {
    const room = rooms.get(k);
    for (const n of linkedNeighbors(rooms, room.x, room.y)) {
      const nk = key(n.x, n.y);
      if (!chosen.includes(nk) && !assigned.has(nk)) frontier.set(nk, true);
    }
  };
  extend(seedKey);

  while (Object.keys(need).length) {
    let picked = null;
    for (const k of frontier.keys()) {
      const room = rooms.get(k);
      if (room && need[room.card]) {
        picked = k;
        break;
      }
    }
    if (!picked) return null;
    frontier.delete(picked);
    chosen.push(picked);
    const card = rooms.get(picked).card;
    need[card] -= 1;
    if (need[card] === 0) delete need[card];
    extend(picked);
  }
  return chosen;
}

/** Connected component of rooms carrying `tag`, ignoring already-claimed rooms. */
function tagComponent(rooms, seedKey, tag, assigned, seen) {
  const out = [];
  const stack = [seedKey];
  while (stack.length) {
    const k = stack.pop();
    if (seen.has(k) || assigned.has(k)) continue;
    const room = rooms.get(k);
    if (!room || !room.tags.includes(tag)) continue;
    seen.add(k);
    out.push(k);
    for (const n of linkedNeighbors(rooms, room.x, room.y)) stack.push(key(n.x, n.y));
  }
  return out;
}

/**
 * Returns a Map of roomKey → biomeId for the whole dungeon. Recomputed from
 * scratch after every placement: biomes can grow, and a room can be pulled into
 * a better one when the right neighbour lands.
 */
export function detectBiomes(rooms) {
  const assigned = new Map();
  for (const biome of byPriority) {
    if (biome.cards) {
      for (const seedKey of rooms.keys()) {
        if (assigned.has(seedKey)) continue;
        const clump = matchCardRecipe(rooms, seedKey, biome.cards, assigned);
        if (clump) for (const k of clump) assigned.set(k, biome.id);
      }
    } else if (biome.tag) {
      const seen = new Set();
      for (const seedKey of rooms.keys()) {
        if (assigned.has(seedKey) || seen.has(seedKey)) continue;
        const comp = tagComponent(rooms, seedKey, biome.tag, assigned, seen);
        if (comp.length >= (biome.count || 3)) for (const k of comp) assigned.set(k, biome.id);
      }
    }
  }
  return assigned;
}

/** Merges every aura in play into one set of multipliers for a room. */
export function biomeAura(biomeId) {
  const b = biomeId && BIOME_BY_ID[biomeId];
  return (b && b.aura) || null;
}

export function biomeOf(biomeId) {
  return biomeId ? BIOME_BY_ID[biomeId] : null;
}
