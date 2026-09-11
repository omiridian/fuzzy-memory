// Drawing the dungeon. Rooms are baked to their own little offscreen canvas the
// first time they are drawn in a given state, so a forty-room dungeon costs
// forty blits rather than three thousand rectangles.

import { DOOR_PX, ROOM_PX, TILE, WALL, hasDoor, roomBounds, roomCenter } from '../systems/grid.js';
import { SIDES } from '../data/cards.js';
import { biomeOf } from '../systems/biomes.js';
import { FONT_DISPLAY, text } from './ui.js';

const FLOORS = {
  stone: { base: '#3c3b47', alt: '#45444f', grout: '#2c2b35' },
  cave: { base: '#453a30', alt: '#4e4237', grout: '#332c25' },
  marble: { base: '#4e4c58', alt: '#595662', grout: '#3b3944' },
  wood: { base: '#4a3a2a', alt: '#544230', grout: '#33281d' },
  water: { base: '#24424f', alt: '#2a4c5d', grout: '#1b323a' },
  ash: { base: '#3b3333', alt: '#463a38', grout: '#2b2523' },
};

const WALL_FACE = '#211f2b';
const WALL_TOP = '#3a3548';
const WALL_EDGE = '#15141c';

/** Stable pseudo-random in [0,1) from three integers — no allocation, no state. */
function hash3(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Reads a room's own door mask by side index. */
function roomHasDoor(room, side) {
  return hasDoor(room.doors, side);
}

// ---------------------------------------------------------------------------
// Room baking
// ---------------------------------------------------------------------------

function roomSignature(room) {
  return `${room.entered ? 'e' : room.scouted ? 's' : 'h'}|${room.biome || '-'}|${room.doors}`;
}

function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function bakeRoom(room) {
  const canvas = makeCanvas(ROOM_PX, ROOM_PX);
  if (!canvas) return null;
  const g = canvas.getContext('2d');
  const known = room.entered || room.scouted;
  const palette = FLOORS[room.floor] || FLOORS.stone;

  // Floor -----------------------------------------------------------------
  g.fillStyle = palette.grout;
  g.fillRect(0, 0, ROOM_PX, ROOM_PX);
  const inner = { x: WALL, y: WALL, w: ROOM_PX - WALL * 2, h: ROOM_PX - WALL * 2 };
  drawTiles(g, room, palette, inner.x, inner.y, inner.w, inner.h, known);

  // Floor carried through each doorway, so two rooms read as one place.
  for (let side = 0; side < 4; side++) {
    if (!roomHasDoor(room, side)) continue;
    const gap = doorGapRect(side);
    drawTiles(g, room, palette, gap.x, gap.y, gap.w, gap.h, known);
  }

  // Decor and clutter -----------------------------------------------------
  if (known) {
    g.save();
    g.globalAlpha = room.entered ? 1 : 0.45;
    drawProps(g, room);
    drawDecor(g, room);
    g.restore();
  }

  // Walls -----------------------------------------------------------------
  drawWalls(g, room);

  // Biome wash ------------------------------------------------------------
  const biome = biomeOf(room.biome);
  if (biome && known) {
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.3;
    g.fillStyle = biome.tint;
    g.fillRect(0, 0, ROOM_PX, ROOM_PX);
    g.restore();
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = biome.tint;
    g.lineWidth = 2;
    g.strokeRect(WALL - 1, WALL - 1, ROOM_PX - WALL * 2 + 2, ROOM_PX - WALL * 2 + 2);
    g.restore();
  }

  // Unknown rooms keep a card back over the floor: you built it, you have not
  // seen inside it.
  if (!known) {
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = '#14131c';
    g.fillRect(WALL, WALL, ROOM_PX - WALL * 2, ROOM_PX - WALL * 2);
    g.globalAlpha = 0.5;
    g.strokeStyle = '#4a4258';
    g.lineWidth = 1;
    for (let i = -ROOM_PX; i < ROOM_PX * 2; i += 12) {
      g.beginPath();
      g.moveTo(i, WALL);
      g.lineTo(i - ROOM_PX, ROOM_PX - WALL);
      g.stroke();
    }
    g.globalAlpha = 0.9;
    g.fillStyle = '#5b5270';
    g.beginPath();
    g.arc(ROOM_PX / 2, ROOM_PX / 2, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#14131c';
    g.font = 'bold 18px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('?', ROOM_PX / 2, ROOM_PX / 2 + 6);
    g.restore();
  }

  return canvas;
}

function doorGapRect(side) {
  const half = (ROOM_PX - DOOR_PX) / 2;
  switch (side) {
    case 0: return { x: half, y: 0, w: DOOR_PX, h: WALL };
    case 1: return { x: ROOM_PX - WALL, y: half, w: WALL, h: DOOR_PX };
    case 2: return { x: half, y: ROOM_PX - WALL, w: DOOR_PX, h: WALL };
    default: return { x: 0, y: half, w: WALL, h: DOOR_PX };
  }
}

function drawTiles(g, room, palette, x, y, w, h, known) {
  const x0 = Math.floor(x / TILE);
  const y0 = Math.floor(y / TILE);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  for (let ty = y0; ty * TILE < y + h; ty++) {
    for (let tx = x0; tx * TILE < x + w; tx++) {
      const n = hash3(tx + room.x * 9, ty + room.y * 9, room.seed);
      g.fillStyle = n > 0.5 ? palette.alt : palette.base;
      g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      if (known && n > 0.93) {
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(tx * TILE + 3, ty * TILE + 4, 5, 3);
      }
      g.strokeStyle = palette.grout;
      g.lineWidth = 1;
      g.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }
  g.restore();
}

function drawWalls(g, room) {
  const segments = [];
  const half = (ROOM_PX - DOOR_PX) / 2;
  for (let side = 0; side < 4; side++) {
    const open = roomHasDoor(room, side);
    if (side === 0 || side === 2) {
      const y = side === 0 ? 0 : ROOM_PX - WALL;
      if (open) {
        segments.push({ x: 0, y, w: half, h: WALL, side });
        segments.push({ x: half + DOOR_PX, y, w: half, h: WALL, side });
      } else segments.push({ x: 0, y, w: ROOM_PX, h: WALL, side });
    } else {
      const x = side === 3 ? 0 : ROOM_PX - WALL;
      if (open) {
        segments.push({ x, y: 0, w: WALL, h: half, side });
        segments.push({ x, y: half + DOOR_PX, w: WALL, h: half, side });
      } else segments.push({ x, y: 0, w: WALL, h: ROOM_PX, side });
    }
  }
  for (const s of segments) {
    g.fillStyle = WALL_FACE;
    g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = WALL_TOP;
    if (s.side === 0) g.fillRect(s.x, s.y + s.h - 3, s.w, 3);
    else if (s.side === 2) g.fillRect(s.x, s.y, s.w, 3);
    else if (s.side === 1) g.fillRect(s.x, s.y, 3, s.h);
    else g.fillRect(s.x + s.w - 3, s.y, 3, s.h);
    g.strokeStyle = WALL_EDGE;
    g.lineWidth = 1;
    g.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
    // Courses of masonry, so walls are not flat slabs.
    g.fillStyle = 'rgba(255,255,255,0.04)';
    if (s.w > s.h) {
      for (let x = s.x + 8; x < s.x + s.w; x += 16) g.fillRect(x, s.y + 2, 1, s.h - 4);
    } else {
      for (let y = s.y + 8; y < s.y + s.h; y += 16) g.fillRect(s.x + 2, y, s.w - 4, 1);
    }
  }
  // Door jambs
  for (let side = 0; side < 4; side++) {
    if (!roomHasDoor(room, side)) continue;
    const r = doorGapRect(side);
    g.fillStyle = '#4b4459';
    if (side === 0 || side === 2) {
      g.fillRect(r.x - 2, r.y, 2, r.h);
      g.fillRect(r.x + r.w, r.y, 2, r.h);
    } else {
      g.fillRect(r.x, r.y - 2, r.w, 2);
      g.fillRect(r.x, r.y + r.h, r.w, 2);
    }
  }
}

function drawProps(g, room) {
  const ox = room.x * ROOM_PX;
  const oy = room.y * ROOM_PX;
  for (const p of room.props) {
    const x = p.x - ox;
    const y = p.y - oy;
    g.save();
    g.translate(x, y);
    g.rotate(p.a);
    if (p.v === 0) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.ellipse(0, 0, p.r * 1.4, p.r * 0.7, 0, 0, Math.PI * 2);
      g.fill();
    } else if (p.v === 1) {
      g.fillStyle = '#54505c';
      g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.fillRect(-p.r, -p.r * 0.6, p.r * 2, 2);
    } else if (p.v === 2) {
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-p.r * 1.6, 0);
      g.lineTo(p.r * 0.4, -p.r * 0.5);
      g.lineTo(p.r * 1.6, p.r * 0.3);
      g.stroke();
    } else {
      g.fillStyle = '#3f3a46';
      g.beginPath();
      g.arc(0, 0, p.r * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

/** The bit that makes a Crypt look like a crypt and not a grey box. */
function drawDecor(g, room) {
  const c = ROOM_PX / 2;
  const rnd = (i) => hash3(room.x, room.y, room.seed + i * 17);
  switch (room.decor) {
    case 'entrance': {
      g.fillStyle = 'rgba(255, 240, 190, 0.16)';
      g.beginPath();
      g.arc(c, c - 6, 34, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#8a6a3f';
      g.lineWidth = 2;
      for (const dx of [-6, 6]) {
        g.beginPath();
        g.moveTo(c + dx, c - 34);
        g.lineTo(c + dx, c + 26);
        g.stroke();
      }
      g.lineWidth = 2.5;
      for (let y = -28; y < 26; y += 9) {
        g.beginPath();
        g.moveTo(c - 6, c + y);
        g.lineTo(c + 6, c + y);
        g.stroke();
      }
      break;
    }
    case 'torches':
      for (const p of [[c, WALL + 6], [c, ROOM_PX - WALL - 6], [WALL + 6, c], [ROOM_PX - WALL - 6, c]]) {
        g.fillStyle = '#6b5636';
        g.fillRect(p[0] - 2, p[1] - 5, 4, 10);
        g.fillStyle = 'rgba(255,170,60,0.9)';
        g.beginPath();
        g.arc(p[0], p[1] - 6, 3.4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'tombs':
      for (let i = 0; i < 3; i++) {
        const x = 34 + i * 38;
        const y = 48 + (i % 2) * 40;
        g.fillStyle = '#6a6673';
        g.fillRect(x - 13, y - 20, 26, 40);
        g.fillStyle = '#7d7887';
        g.fillRect(x - 13, y - 20, 26, 5);
        g.fillStyle = '#1a1820';
        g.fillRect(x - 9, y - 12 + (rnd(i) > 0.5 ? 6 : 0), 18, 9);
      }
      break;
    case 'bones':
      for (let i = 0; i < 9; i++) {
        const x = 26 + rnd(i) * 92;
        const y = 26 + rnd(i + 40) * 92;
        g.fillStyle = '#cdc6b0';
        g.save();
        g.translate(x, y);
        g.rotate(rnd(i + 80) * Math.PI);
        g.fillRect(-7, -1.4, 14, 2.8);
        g.beginPath();
        g.arc(-7, 0, 2.2, 0, Math.PI * 2);
        g.arc(7, 0, 2.2, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      break;
    case 'shrine': {
      g.fillStyle = '#6f6a7d';
      g.fillRect(c - 16, c - 30, 32, 12);
      g.fillStyle = '#8e8aa0';
      g.beginPath();
      g.moveTo(c, c - 56);
      g.quadraticCurveTo(c + 13, c - 38, c + 10, c - 18);
      g.lineTo(c - 10, c - 18);
      g.quadraticCurveTo(c - 13, c - 38, c, c - 56);
      g.fill();
      g.fillStyle = '#9fd8ff';
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(c, c + 14, 20, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      break;
    }
    case 'hoard':
      for (let i = 0; i < 22; i++) {
        const x = 30 + rnd(i) * 84;
        const y = 34 + rnd(i + 30) * 80;
        g.fillStyle = i % 3 ? '#e8b64c' : '#f5d98a';
        g.beginPath();
        g.arc(x, y, 2.6 + rnd(i + 60) * 2.4, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#7a5a2c';
      g.fillRect(c - 22, c + 20, 44, 20);
      g.fillStyle = '#a37a3c';
      g.fillRect(c - 22, c + 20, 44, 5);
      break;
    case 'books':
      for (const [x, y, w, h] of [[WALL + 3, 30, 10, 82], [ROOM_PX - WALL - 13, 30, 10, 82], [40, WALL + 3, 64, 10]]) {
        g.fillStyle = '#4a3726';
        g.fillRect(x, y, w, h);
        for (let i = 0; i < 14; i++) {
          g.fillStyle = ['#6d3a36', '#3a526d', '#6b5d34', '#456b43'][i % 4];
          if (w < h) g.fillRect(x + 2, y + 3 + i * 5.6, w - 4, 4.2);
          else g.fillRect(x + 3 + i * 4.4, y + 2, 3.4, h - 4);
        }
      }
      break;
    case 'lab':
      g.fillStyle = '#4d3b2a';
      g.fillRect(c - 34, c - 6, 68, 14);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = ['#8fd24f', '#d0708f', '#7fd7ff', '#ffd27a'][i % 4];
        g.beginPath();
        g.arc(c - 28 + i * 11, c - 11, 4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'racks':
      for (const x of [30, ROOM_PX - 30]) {
        g.fillStyle = '#4a3726';
        g.fillRect(x - 12, 32, 24, 6);
        for (let i = 0; i < 4; i++) {
          g.strokeStyle = '#b9b3a4';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x - 9 + i * 6, 38);
          g.lineTo(x - 9 + i * 6, 62);
          g.stroke();
        }
      }
      break;
    case 'traps':
      for (let ty = 2; ty < 7; ty++) {
        for (let tx = 2; tx < 7; tx++) {
          if ((tx + ty) % 2) continue;
          g.fillStyle = 'rgba(180,160,120,0.18)';
          g.fillRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.beginPath();
          g.arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 1.6, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    case 'water':
      g.fillStyle = 'rgba(20, 48, 62, 0.75)';
      g.beginPath();
      g.ellipse(c, c, 44, 36, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(150, 220, 240, 0.25)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse(c, c, 12 + i * 9, 9 + i * 7, 0, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    case 'fungus':
      for (let i = 0; i < 14; i++) {
        const x = 26 + rnd(i) * 92;
        const y = 30 + rnd(i + 20) * 86;
        const r = 3 + rnd(i + 50) * 6;
        g.fillStyle = '#cfe0a0';
        g.fillRect(x - 1, y, 2, r);
        g.fillStyle = ['#8a6fa0', '#a0c46f', '#6fa0c4'][i % 3];
        g.beginPath();
        g.arc(x, y, r, Math.PI, 0);
        g.fill();
      }
      break;
    case 'lava':
      g.fillStyle = 'rgba(210, 80, 30, 0.55)';
      g.beginPath();
      g.ellipse(c, c + 6, 42, 28, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255, 180, 60, 0.7)';
      g.beginPath();
      g.ellipse(c, c + 6, 26, 15, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'forge':
      g.fillStyle = '#3c3740';
      g.fillRect(c - 20, c - 4, 40, 18);
      g.fillRect(c - 10, c + 14, 20, 10);
      g.fillStyle = 'rgba(255,140,40,0.75)';
      g.beginPath();
      g.ellipse(c + 38, c + 8, 14, 9, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'puzzle':
      for (let i = 0; i < 9; i++) {
        const x = c - 26 + (i % 3) * 26;
        const y = c - 26 + Math.floor(i / 3) * 26;
        g.strokeStyle = '#b6a8d8';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(x, y);
        const a = rnd(i) * Math.PI * 2;
        g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
        g.stroke();
      }
      break;
    case 'gate':
      for (let i = 0; i < 5; i++) {
        const x = 28 + i * 22;
        g.fillStyle = '#6b4a2c';
        g.fillRect(x - 9, c + 10, 18, 14);
        g.fillStyle = '#a37a3c';
        g.fillRect(x - 9, c + 10, 18, 4);
      }
      g.strokeStyle = '#57515f';
      g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(22 + i * 20, WALL);
        g.lineTo(22 + i * 20, 44);
        g.stroke();
      }
      break;
    case 'camp':
      g.fillStyle = '#3a3038';
      g.beginPath();
      g.arc(c, c, 13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6b5636';
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(c, c);
        g.rotate((i / 4) * Math.PI);
        g.fillRect(-9, -1.5, 18, 3);
        g.restore();
      }
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.6;
        g.fillStyle = '#5a4a5e';
        g.save();
        g.translate(c + Math.cos(a) * 34, c + Math.sin(a) * 30);
        g.rotate(a);
        g.fillRect(-11, -5, 22, 10);
        g.restore();
      }
      break;
    case 'rubble':
      for (let i = 0; i < 8; i++) {
        const x = 26 + rnd(i) * 92;
        const y = 30 + rnd(i + 11) * 86;
        g.fillStyle = i % 2 ? '#4e4640' : '#5b524a';
        g.beginPath();
        g.moveTo(x - 8, y + 5);
        g.lineTo(x - 2, y - 6);
        g.lineTo(x + 7, y - 1);
        g.lineTo(x + 5, y + 6);
        g.closePath();
        g.fill();
      }
      g.fillStyle = '#6b5636';
      g.fillRect(WALL + 2, 40, 4, 64);
      g.fillRect(ROOM_PX - WALL - 6, 40, 4, 64);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export class DungeonView {
  constructor() {
    this.lightCanvas = null;
    this.warmCanvas = null;
    this.time = 0;
  }

  ensureBuffers(w, h) {
    if (!this.lightCanvas || this.lightCanvas.width !== w || this.lightCanvas.height !== h) {
      this.lightCanvas = makeCanvas(w, h);
      this.warmCanvas = makeCanvas(w, h);
    }
  }

  /** Draws floors, walls and decor for every placed room. */
  drawRooms(ctx, exp, view) {
    for (const room of exp.dungeon.rooms.values()) {
      const sig = roomSignature(room);
      if (!room.art || room.artSig !== sig) {
        room.art = bakeRoom(room);
        room.artSig = sig;
      }
      if (!room.art) continue;
      const ox = room.x * ROOM_PX;
      const oy = room.y * ROOM_PX;
      if (!view.visible(ox, oy, ROOM_PX, ROOM_PX)) continue;

      if (room.dropT > 0) {
        // The card landing: a short drop with a squash and a shadow.
        const t = room.dropT;
        const lift = t * t * 54;
        const scale = 1 + t * 0.12;
        ctx.save();
        ctx.globalAlpha = 0.45 * (1 - t);
        ctx.fillStyle = '#000';
        ctx.fillRect(ox + 6, oy + 6, ROOM_PX - 12, ROOM_PX - 12);
        ctx.restore();
        ctx.save();
        ctx.translate(ox + ROOM_PX / 2, oy + ROOM_PX / 2 - lift);
        ctx.scale(scale, scale);
        ctx.globalAlpha = Math.min(1, 1.4 - t);
        ctx.drawImage(room.art, -ROOM_PX / 2, -ROOM_PX / 2);
        ctx.restore();
      } else {
        ctx.drawImage(room.art, ox, oy);
      }
    }
  }

  /** Live bits that move: torch flicker, water shimmer, loot glints, features. */
  drawRoomOverlays(ctx, exp, view, dt) {
    this.time += dt;
    for (const room of exp.dungeon.rooms.values()) {
      if (!room.entered && !room.scouted) continue;
      const ox = room.x * ROOM_PX;
      const oy = room.y * ROOM_PX;
      if (!view.visible(ox, oy, ROOM_PX, ROOM_PX)) continue;
      const bounds = roomBounds(room.x, room.y);

      if (room.floor === 'water') {
        ctx.save();
        ctx.globalAlpha = 0.2 + Math.sin(this.time * 1.4 + room.x) * 0.06;
        ctx.strokeStyle = '#9fe0ff';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(ox + ROOM_PX / 2, oy + ROOM_PX / 2, 16 + i * 12 + Math.sin(this.time + i) * 3, 11 + i * 9, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (room.loot && !room.loot.taken) {
        const glint = 0.6 + Math.sin(this.time * 3 + room.x * 2) * 0.35;
        ctx.save();
        ctx.translate(room.loot.x, room.loot.y);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4a2c';
        ctx.fillRect(-9, -8, 18, 12);
        ctx.fillStyle = '#a37a3c';
        ctx.fillRect(-9, -8, 18, 3.5);
        ctx.fillStyle = `rgba(255, 220, 120, ${glint})`;
        ctx.beginPath();
        ctx.arc(4, -10, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const f of room.features) {
        if (f.used || !f.eventId) continue;
        const pulse = 0.45 + Math.sin(this.time * 2.2 + f.x * 0.05) * 0.2;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#cdb9ff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 10 + Math.sin(this.time * 2) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Room name, only once somebody has been inside.
      if (room.entered && view.zoom > 0.72) {
        text(ctx, room.name, ox + ROOM_PX / 2, bounds.top + 11, {
          align: 'center',
          size: 9,
          color: room.cleared ? 'rgba(180,200,170,0.55)' : 'rgba(235,225,200,0.75)',
          font: FONT_DISPLAY,
          shadowBlur: 4,
        });
      }
    }
  }

  /** Darkness, then the warm light that pushes it back. */
  drawLighting(ctx, exp, view, w, h) {
    this.ensureBuffers(w, h);
    if (!this.lightCanvas) return;
    const g = this.lightCanvas.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(5, 6, 12, 0.96)';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';

    // Three levels of knowing. A room you walked through stays dimly
    // remembered; a room you only built is a shape in the dark; a room you
    // have neither built nor seen is not there at all.
    for (const room of exp.dungeon.rooms.values()) {
      const p = view.toScreen(room.x * ROOM_PX, room.y * ROOM_PX);
      const size = ROOM_PX * view.zoom;
      const known = room.entered ? 0.5 : room.scouted ? 0.38 : 0.26;
      g.fillStyle = `rgba(0,0,0,${known})`;
      g.fillRect(p.x, p.y, size, size);
    }

    // Lamps: the party, plus whatever burns on its own.
    const lamps = [];
    for (const adv of exp.party) {
      if (!adv.alive) continue;
      lamps.push({ x: adv.x, y: adv.y, r: 96, strength: 1 });
    }
    for (const room of exp.dungeon.rooms.values()) {
      if (!room.entered || (room.light || 1) <= 1) continue;
      const c = roomCenter(room.x, room.y);
      lamps.push({ x: c.x, y: c.y, r: 60 * room.light, strength: 0.85 });
    }
    for (const lamp of lamps) {
      const p = view.toScreen(lamp.x, lamp.y);
      const r = lamp.r * view.zoom;
      const grad = g.createRadialGradient(p.x, p.y, r * 0.12, p.x, p.y, r);
      grad.addColorStop(0, `rgba(0,0,0,${lamp.strength})`);
      grad.addColorStop(0.65, `rgba(0,0,0,${lamp.strength * 0.55})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.lightCanvas, 0, 0);

    // A warm pass on top, so torchlight reads as light and not as a hole.
    const wg = this.warmCanvas.getContext('2d');
    wg.clearRect(0, 0, w, h);
    for (const lamp of lamps) {
      const p = view.toScreen(lamp.x, lamp.y);
      const r = lamp.r * view.zoom * 1.1;
      const grad = wg.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, 'rgba(255, 206, 140, 0.16)');
      grad.addColorStop(1, 'rgba(255, 180, 90, 0)');
      wg.fillStyle = grad;
      wg.beginPath();
      wg.arc(p.x, p.y, r, 0, Math.PI * 2);
      wg.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.warmCanvas, 0, 0);
    ctx.restore();
  }

  /** The translucent card being placed, with its doors called out. */
  drawGhost(ctx, exp, cell, entry, legal, reason) {
    if (!cell || !entry) return;
    const ox = cell.x * ROOM_PX;
    const oy = cell.y * ROOM_PX;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = legal ? 'rgba(120, 200, 140, 0.34)' : 'rgba(210, 90, 70, 0.3)';
    ctx.fillRect(ox + 3, oy + 3, ROOM_PX - 6, ROOM_PX - 6);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = legal ? '#8fd08a' : '#d2603f';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(ox + 3, oy + 3, ROOM_PX - 6, ROOM_PX - 6);
    ctx.setLineDash([]);

    const doors = entry.doorsMask;
    for (let side = 0; side < 4; side++) {
      if (!(doors & SIDES[side].bit)) continue;
      const r = doorGapRect(side);
      ctx.fillStyle = legal ? 'rgba(180, 255, 190, 0.85)' : 'rgba(255, 160, 140, 0.8)';
      ctx.fillRect(ox + r.x, oy + r.y, r.w, r.h);
    }
    ctx.restore();

    if (!legal && reason) {
      text(ctx, reason, ox + ROOM_PX / 2, oy + ROOM_PX + 16, {
        align: 'center',
        size: 11,
        color: '#ffb4a0',
      });
    }
  }

  /** Where a legal placement exists, for the card you are holding. */
  drawLegalHints(ctx, cells) {
    ctx.save();
    for (const cell of cells) {
      const ox = cell.x * ROOM_PX;
      const oy = cell.y * ROOM_PX;
      ctx.strokeStyle = 'rgba(150, 210, 160, 0.33)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.strokeRect(ox + 8, oy + 8, ROOM_PX - 16, ROOM_PX - 16);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
}

