// Tile definitions. Maps are written as arrays of strings; each character
// maps to one entry here. `solid` blocks movement, `encounter` names the
// wild-encounter table to roll on, and the render fields drive the painter.

export const TILE_SIZE = 24;

const T = {};

function tile(char, opts) {
  T[char] = {
    char,
    name: opts.name,
    solid: !!opts.solid,
    encounter: opts.encounter || null,
    color: opts.color,
    detail: opts.detail || null,
    detailColor: opts.detailColor || null,
    water: !!opts.water,
    ledge: opts.ledge || null,
    surf: !!opts.surf,
    animated: !!opts.animated,
    slow: !!opts.slow,
  };
  return T[char];
}

// ── Outdoor ────────────────────────────────────────────────────────────────
tile('.', { name: 'grass', color: '#4e8b46', detail: 'grass', detailColor: '#5f9c52' });
tile(',', { name: 'tall grass', color: '#3d7a38', detail: 'tallgrass', detailColor: '#2f6a2c', encounter: 'grass' });
tile('"', { name: 'deep grass', color: '#336a30', detail: 'tallgrass', detailColor: '#275625', encounter: 'grass_rare' });
tile('p', { name: 'path', color: '#c2a878', detail: 'speckle', detailColor: '#b39a68' });
tile('P', { name: 'paving', color: '#b6b0a4', detail: 'brick', detailColor: '#a29c90' });
tile('#', { name: 'tree', color: '#2f6a2c', solid: true, detail: 'tree', detailColor: '#1e4a1d' });
tile('O', { name: 'house wall', color: '#b08a62', solid: true, detail: 'housewall', detailColor: '#8a6a48' });
tile('T', { name: 'pine', color: '#265c30', solid: true, detail: 'pine', detailColor: '#17401f' });
tile('M', { name: 'cliff', color: '#7d6b57', solid: true, detail: 'cliff', detailColor: '#5c4d3e' });
tile('R', { name: 'boulder', color: '#8a7c68', solid: true, detail: 'rock', detailColor: '#6a5e4d' });
tile('r', { name: 'cracked rock', color: '#8a7c68', solid: true, detail: 'crack', detailColor: '#5c4d3e' });
tile('~', { name: 'water', color: '#3f7fc0', solid: true, water: true, surf: true, animated: true, encounter: 'water', detail: 'wave', detailColor: '#5a97d4' });
tile('W', { name: 'deep water', color: '#2b5f9a', solid: true, water: true, surf: true, animated: true, encounter: 'water_deep', detail: 'wave', detailColor: '#3f7fc0' });
tile('w', { name: 'pool', color: '#3f7fc0', solid: true, water: true, animated: true, detail: 'wave', detailColor: '#5a97d4' });
tile('s', { name: 'sand', color: '#dbc48c', detail: 'speckle', detailColor: '#cbb47c' });
tile('f', { name: 'flowers', color: '#4e8b46', detail: 'flowers', detailColor: '#e8d060' });
tile('B', { name: 'bridge', color: '#9a7448', detail: 'plank', detailColor: '#7d5c36' });
tile('L', { name: 'ledge', color: '#6f8b46', ledge: 'down', detail: 'ledge', detailColor: '#4e6b30' });
tile('m', { name: 'marsh', color: '#4a6b48', encounter: 'marsh', slow: true, detail: 'speckle', detailColor: '#3b5a3a' });
tile('a', { name: 'ash', color: '#6b6560', encounter: 'volcano', detail: 'speckle', detailColor: '#57524e' });
tile('n', { name: 'snow', color: '#dfe8ee', encounter: 'tundra', detail: 'speckle', detailColor: '#c8d4dd' });
tile('d', { name: 'dune', color: '#d8bd7f', encounter: 'desert', detail: 'speckle', detailColor: '#c6aa6d' });

// ── Cave and interior ──────────────────────────────────────────────────────
tile('X', { name: 'cave floor', color: '#5b5148', detail: 'speckle', detailColor: '#4a423b' });
tile('x', { name: 'cave grass', color: '#4a4a3d', encounter: 'cave', detail: 'tallgrass', detailColor: '#3a3a30' });
tile('%', { name: 'cave wall', color: '#39322c', solid: true, detail: 'cliff', detailColor: '#241f1b' });
tile('=', { name: 'floor', color: '#c8b192', detail: 'plank', detailColor: '#b49c7d' });
tile('_', { name: 'tile floor', color: '#d5d8de', detail: 'brick', detailColor: '#c2c6cd' });
tile('|', { name: 'wall', color: '#8c6f52', solid: true, detail: 'brick', detailColor: '#725a42' });
tile('C', { name: 'counter', color: '#a9764a', solid: true, detail: 'plank', detailColor: '#8a5f3a' });
tile('t', { name: 'table', color: '#b58c5e', solid: true, detail: 'plank', detailColor: '#96714a' });
tile('b', { name: 'bookshelf', color: '#7d5a3c', solid: true, detail: 'books', detailColor: '#3f6b8b' });
tile('h', { name: 'bed', color: '#e0e4ea', solid: true, detail: 'bed', detailColor: '#c05a6a' });
tile('o', { name: 'pot', color: '#8a9a6a', solid: true, detail: 'pot', detailColor: '#6a7a4a' });
tile('S', { name: 'sign', color: '#9a7448', solid: true, detail: 'sign', detailColor: '#e8dcc0' });
tile('D', { name: 'door', color: '#5a3f28', detail: 'door', detailColor: '#8a6a48' });
tile('E', { name: 'stairs', color: '#8a8276', detail: 'stairs', detailColor: '#6a6258' });
tile('H', { name: 'healing pad', color: '#e8d8a0', detail: 'circle', detailColor: '#f0b040' });
tile('G', { name: 'gate', color: '#6a6a72', solid: true, detail: 'gate', detailColor: '#4a4a52' });
tile('!', { name: 'rift', color: '#7a3a6a', encounter: 'rift', animated: true, detail: 'rift', detailColor: '#d9534f' });
tile('i', { name: 'rift glow', color: '#5a2a52', animated: true, detail: 'rift', detailColor: '#b0507a' });
tile('*', { name: 'shrine floor', color: '#d8cba0', detail: 'circle', detailColor: '#b8a878' });

export const TILES = T;

export function tileAt(map, x, y) {
  if (y < 0 || y >= map.tiles.length) return null;
  const row = map.tiles[y];
  if (x < 0 || x >= row.length) return null;
  return T[row[x]] || null;
}

export function isSolid(map, x, y) {
  const t = tileAt(map, x, y);
  return !t || t.solid;
}
