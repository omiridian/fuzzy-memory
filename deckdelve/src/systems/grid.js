// Pure geometry and placement law. No rendering, no randomness — everything
// here is testable under Node, which matters because the placement rule is the
// single most load-bearing thing in the game.

import { SIDES } from '../data/cards.js';

export const TILE = 16;
export const ROOM_TILES = 9;
export const ROOM_PX = TILE * ROOM_TILES; // 144
export const WALL = TILE; // one tile of masonry on every side
export const DOOR_TILES = 3;
export const DOOR_PX = TILE * DOOR_TILES;
export const GRID_LIMIT = 11; // the dungeon may not sprawl past this ring

export const key = (x, y) => `${x},${y}`;

export function parseKey(k) {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

/** Side index of the door you come out of when you go back the other way. */
export const opposite = (side) => (side + 2) % 4;

export function roomOrigin(gx, gy) {
  return { x: gx * ROOM_PX, y: gy * ROOM_PX };
}

export function roomCenter(gx, gy) {
  return { x: gx * ROOM_PX + ROOM_PX / 2, y: gy * ROOM_PX + ROOM_PX / 2 };
}

/** The walkable interior of a room, in world pixels. */
export function roomBounds(gx, gy) {
  const o = roomOrigin(gx, gy);
  return {
    left: o.x + WALL,
    top: o.y + WALL,
    right: o.x + ROOM_PX - WALL,
    bottom: o.y + ROOM_PX - WALL,
  };
}

/** The point exactly in the doorway on `side` — shared by both rooms. */
export function doorPoint(gx, gy, side) {
  const o = roomOrigin(gx, gy);
  const half = ROOM_PX / 2;
  switch (side) {
    case 0: return { x: o.x + half, y: o.y };
    case 1: return { x: o.x + ROOM_PX, y: o.y + half };
    case 2: return { x: o.x + half, y: o.y + ROOM_PX };
    default: return { x: o.x, y: o.y + half };
  }
}

/** A point just inside the room, level with the doorway — the approach step. */
export function doorApproach(gx, gy, side) {
  const p = doorPoint(gx, gy, side);
  const s = SIDES[side];
  return { x: p.x - s.dx * WALL, y: p.y - s.dy * WALL };
}

/** World pixel → grid cell. */
export function worldToGrid(x, y) {
  return { x: Math.floor(x / ROOM_PX), y: Math.floor(y / ROOM_PX) };
}

export function hasDoor(mask, side) {
  return (mask & SIDES[side].bit) !== 0;
}

export function neighborOf(gx, gy, side) {
  const s = SIDES[side];
  return { x: gx + s.dx, y: gy + s.dy };
}

export function withinLimit(gx, gy) {
  return Math.abs(gx) <= GRID_LIMIT && Math.abs(gy) <= GRID_LIMIT;
}

/**
 * The placement law, in one function.
 *
 * A card may go into an empty cell inside the grid limit when every wall it
 * shares with a neighbour agrees with that neighbour — door to door, or stone
 * to stone — and at least one of those agreements is a door, so the new room is
 * actually reachable. A door facing open space is fine: that is the frontier.
 *
 * `rooms` is any Map-like with `.get(key)` / `.has(key)`.
 */
export function canPlace(rooms, gx, gy, doors) {
  if (!withinLimit(gx, gy)) return { ok: false, reason: 'The dungeon does not reach that far.' };
  if (rooms.has(key(gx, gy))) return { ok: false, reason: 'Something is already there.' };

  let connections = 0;
  let touching = 0;
  for (let side = 0; side < 4; side++) {
    const n = neighborOf(gx, gy, side);
    const other = rooms.get(key(n.x, n.y));
    if (!other) continue;
    touching++;
    const mine = hasDoor(doors, side);
    const theirs = hasDoor(other.doors, opposite(side));
    if (mine !== theirs) {
      return {
        ok: false,
        reason: mine
          ? `That door opens onto the wall of the ${other.name}.`
          : `The ${other.name} has a door there, and this card has none.`,
      };
    }
    if (mine && theirs) connections++;
  }

  if (!touching) return { ok: false, reason: 'Rooms must be built onto the dungeon.' };
  if (!connections) return { ok: false, reason: 'No door lines up — nobody could get in.' };
  return { ok: true, connections };
}

/** Cells a card with this door mask could legally occupy right now. */
export function legalCells(rooms, doors) {
  const out = [];
  const seen = new Set();
  for (const k of rooms.keys()) {
    const { x, y } = parseKey(k);
    for (let side = 0; side < 4; side++) {
      const n = neighborOf(x, y, side);
      const nk = key(n.x, n.y);
      if (seen.has(nk) || rooms.has(nk)) continue;
      seen.add(nk);
      if (canPlace(rooms, n.x, n.y, doors).ok) out.push({ x: n.x, y: n.y });
    }
  }
  return out;
}

/** Open doorways with nothing behind them yet — where the dungeon can grow. */
export function frontierDoors(rooms) {
  const out = [];
  for (const [k, room] of rooms) {
    const { x, y } = parseKey(k);
    for (let side = 0; side < 4; side++) {
      if (!hasDoor(room.doors, side)) continue;
      const n = neighborOf(x, y, side);
      if (!rooms.has(key(n.x, n.y))) out.push({ x, y, side, to: n });
    }
  }
  return out;
}

/** Grid neighbours joined by a matching pair of doors. */
export function linkedNeighbors(rooms, gx, gy) {
  const room = rooms.get(key(gx, gy));
  if (!room) return [];
  const out = [];
  for (let side = 0; side < 4; side++) {
    if (!hasDoor(room.doors, side)) continue;
    const n = neighborOf(gx, gy, side);
    const other = rooms.get(key(n.x, n.y));
    if (other && hasDoor(other.doors, opposite(side))) out.push({ x: n.x, y: n.y, side, room: other });
  }
  return out;
}

/** Breadth-first room path from one cell to another, inclusive of both ends. */
export function findPath(rooms, from, to) {
  const startKey = key(from.x, from.y);
  const goalKey = key(to.x, to.y);
  if (!rooms.has(startKey) || !rooms.has(goalKey)) return null;
  if (startKey === goalKey) return [{ x: from.x, y: from.y }];

  const prev = new Map([[startKey, null]]);
  const queue = [{ x: from.x, y: from.y }];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of linkedNeighbors(rooms, cur.x, cur.y)) {
      const nk = key(n.x, n.y);
      if (prev.has(nk)) continue;
      prev.set(nk, cur);
      if (nk === goalKey) {
        const path = [];
        let node = { x: n.x, y: n.y };
        let nodeKey = nk;
        while (node) {
          path.unshift(node);
          node = prev.get(nodeKey);
          if (node) nodeKey = key(node.x, node.y);
        }
        return path;
      }
      queue.push({ x: n.x, y: n.y });
    }
  }
  return null;
}

/** Room-steps from the entrance, used for depth, loot quality and dread. */
export function depthMap(rooms, origin = { x: 0, y: 0 }) {
  const depth = new Map();
  const startKey = key(origin.x, origin.y);
  if (!rooms.has(startKey)) return depth;
  depth.set(startKey, 0);
  const queue = [origin];
  while (queue.length) {
    const cur = queue.shift();
    const d = depth.get(key(cur.x, cur.y));
    for (const n of linkedNeighbors(rooms, cur.x, cur.y)) {
      const nk = key(n.x, n.y);
      if (depth.has(nk)) continue;
      depth.set(nk, d + 1);
      queue.push({ x: n.x, y: n.y });
    }
  }
  return depth;
}

/** Waypoints through a room path: centre, doorway, centre, doorway, centre… */
export function waypointsAlong(path) {
  const points = [];
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    points.push({ ...roomCenter(cell.x, cell.y), cell });
    const next = path[i + 1];
    if (!next) continue;
    const side = SIDES.findIndex((s) => s.dx === next.x - cell.x && s.dy === next.y - cell.y);
    if (side >= 0) points.push({ ...doorPoint(cell.x, cell.y, side), cell, door: true });
  }
  return points;
}

/** True when the point is inside the room's walls (the doorway counts). */
export function insideRoom(gx, gy, x, y, pad = 0) {
  const b = roomBounds(gx, gy);
  return x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad;
}

/** Keeps an actor off the masonry, letting them through open doorways only. */
export function clampToRoom(room, gx, gy, x, y, radius = 5) {
  const b = roomBounds(gx, gy);
  const half = DOOR_PX / 2 - radius;
  const c = roomCenter(gx, gy);
  let nx = x;
  let ny = y;

  if (ny < b.top + radius) {
    const inDoorway = hasDoor(room.doors, 0) && Math.abs(nx - c.x) < half;
    if (!inDoorway) ny = b.top + radius;
  }
  if (ny > b.bottom - radius) {
    const inDoorway = hasDoor(room.doors, 2) && Math.abs(nx - c.x) < half;
    if (!inDoorway) ny = b.bottom - radius;
  }
  if (nx < b.left + radius) {
    const inDoorway = hasDoor(room.doors, 3) && Math.abs(ny - c.y) < half;
    if (!inDoorway) nx = b.left + radius;
  }
  if (nx > b.right - radius) {
    const inDoorway = hasDoor(room.doors, 1) && Math.abs(ny - c.y) < half;
    if (!inDoorway) nx = b.right - radius;
  }
  return { x: nx, y: ny };
}
