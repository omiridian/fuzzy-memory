// Draws the overworld: tiles with their little details, then NPCs, items and
// the player, sorted so things nearer the bottom of the screen draw last.

import { TILES, TILE_SIZE, tileAt } from '../world/tiles.js';
import { drawPerson } from './sprites.js';
import { rngFromString } from '../core/rng.js';

/** Per-tile decoration. Kept cheap: this runs for every visible tile. */
function drawDetail(ctx, tile, x, y, size, time, seed) {
  const c = tile.detailColor || tile.color;
  switch (tile.detail) {
    case 'grass':
      ctx.fillStyle = c;
      for (let i = 0; i < 3; i++) {
        const gx = x + ((seed * (i + 3)) % (size - 4)) + 2;
        const gy = y + ((seed * (i + 7)) % (size - 6)) + 3;
        ctx.fillRect(gx, gy, 2, 3);
      }
      break;
    case 'tallgrass': {
      ctx.fillStyle = c;
      const sway = Math.sin(time * 2 + seed) * 1.2;
      for (let i = 0; i < 4; i++) {
        const gx = x + 3 + i * 5;
        ctx.beginPath();
        ctx.moveTo(gx, y + size - 2);
        ctx.lineTo(gx + sway, y + 5);
        ctx.lineWidth = 2;
        ctx.strokeStyle = c;
        ctx.stroke();
      }
      break;
    }
    case 'tree':
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(x + size / 2 - 2, y + size - 8, 4, 8);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2 - 2, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(x + size * 0.38, y + size * 0.36, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'pine':
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(x + size / 2 - 2, y + size - 7, 4, 7);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y + 1);
      ctx.lineTo(x + size - 3, y + size - 6);
      ctx.lineTo(x + 3, y + size - 6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'housewall':
      ctx.fillStyle = c;
      ctx.fillRect(x, y, size, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + 5 + ((size - 5) / 3) * i);
        ctx.lineTo(x + size, y + 5 + ((size - 5) / 3) * i);
        ctx.stroke();
      }
      break;
    case 'cliff':
      ctx.fillStyle = c;
      ctx.fillRect(x, y + size * 0.6, size, size * 0.4);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y + size - 4, size, 4);
      break;
    case 'rock':
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x + size / 2, y + size * 0.62, size * 0.34, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'crack':
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x + size / 2, y + size * 0.6, size * 0.34, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a2420';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.3, y + size * 0.4);
      ctx.lineTo(x + size * 0.55, y + size * 0.75);
      ctx.stroke();
      break;
    case 'wave': {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      const offset = Math.sin(time * 1.6 + seed) * 2;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + size * 0.4 + offset);
      ctx.quadraticCurveTo(x + size / 2, y + size * 0.28 + offset, x + size - 2, y + size * 0.4 + offset);
      ctx.stroke();
      break;
    }
    case 'speckle':
      ctx.fillStyle = c;
      for (let i = 0; i < 4; i++) {
        const gx = x + ((seed * (i + 2)) % (size - 3));
        const gy = y + ((seed * (i + 5)) % (size - 3));
        ctx.fillRect(gx, gy, 2, 2);
      }
      break;
    case 'brick':
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size / 2 - 1);
      ctx.strokeRect(x + 0.5, y + size / 2 + 0.5, size - 1, size / 2 - 1);
      break;
    case 'plank':
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + (size / 3) * i);
        ctx.lineTo(x + size, y + (size / 3) * i);
        ctx.stroke();
      }
      break;
    case 'flowers':
      ctx.fillStyle = c;
      for (let i = 0; i < 3; i++) {
        const gx = x + 4 + i * 6;
        const gy = y + 6 + ((seed * (i + 1)) % 8);
        ctx.beginPath();
        ctx.arc(gx, gy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'books':
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ['#3f6b8b', '#8b3f4a', '#6b8b3f', '#8b7a3f'][i % 4];
        ctx.fillRect(x + 2 + i * 5, y + 4, 4, size - 10);
      }
      break;
    case 'bed':
      ctx.fillStyle = c;
      ctx.fillRect(x + 2, y + 2, size - 4, size * 0.4);
      break;
    case 'pot':
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size * 0.55, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'sign':
      ctx.fillStyle = '#6a4a28';
      ctx.fillRect(x + size / 2 - 2, y + size * 0.5, 4, size * 0.5);
      ctx.fillStyle = c;
      ctx.fillRect(x + 3, y + 4, size - 6, size * 0.45);
      break;
    case 'door':
      ctx.fillStyle = c;
      ctx.fillRect(x + 4, y + 3, size - 8, size - 3);
      ctx.fillStyle = '#f0d070';
      ctx.fillRect(x + size - 9, y + size * 0.55, 3, 3);
      break;
    case 'stairs':
      ctx.fillStyle = c;
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 2, y + 4 + i * 6, size - 4 - i * 4, 4);
      break;
    case 'circle': {
      const pulse = 0.5 + Math.sin(time * 2 + seed) * 0.12;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.32 * (0.8 + pulse * 0.4), 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'gate':
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 4 + i * 7, y + 2);
        ctx.lineTo(x + 4 + i * 7, y + size - 2);
        ctx.stroke();
      }
      break;
    case 'ledge':
      ctx.fillStyle = c;
      ctx.fillRect(x, y + size - 7, size, 7);
      break;
    case 'rift': {
      const wobble = Math.sin(time * 3 + seed) * 3;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.3, y + 2);
      ctx.lineTo(x + size * 0.5 + wobble, y + size * 0.5);
      ctx.lineTo(x + size * 0.35, y + size - 2);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
}

export class MapView {
  constructor(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
    this.camX = 0;
    this.camY = 0;
    this.time = 0;
  }

  centerOn(px, py, map, tileSize = TILE_SIZE) {
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;
    const mapW = map.width * tileSize;
    const mapH = map.height * tileSize;
    let cx = px * tileSize + tileSize / 2 - halfW;
    let cy = py * tileSize + tileSize / 2 - halfH;
    if (mapW <= this.viewWidth) cx = (mapW - this.viewWidth) / 2;
    else cx = Math.max(0, Math.min(mapW - this.viewWidth, cx));
    if (mapH <= this.viewHeight) cy = (mapH - this.viewHeight) / 2;
    else cy = Math.max(0, Math.min(mapH - this.viewHeight, cy));
    this.camX = cx;
    this.camY = cy;
  }

  /**
   * @param entities array of { x, y, sprite, dir, frame, offsetX, offsetY }
   */
  render(ctx, map, entities, dt, opts = {}) {
    this.time += dt;
    const size = TILE_SIZE;
    const startX = Math.max(0, Math.floor(this.camX / size));
    const startY = Math.max(0, Math.floor(this.camY / size));
    const endX = Math.min(map.width, Math.ceil((this.camX + this.viewWidth) / size) + 1);
    const endY = Math.min(map.height, Math.ceil((this.camY + this.viewHeight) / size) + 1);

    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));

    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const tile = tileAt(map, tx, ty);
        if (!tile) continue;
        const x = tx * size;
        const y = ty * size;
        ctx.fillStyle = tile.color;
        ctx.fillRect(x, y, size, size);
        const seed = ((tx * 73856093) ^ (ty * 19349663)) & 31;
        drawDetail(ctx, tile, x, y, size, this.time, seed);
      }
    }

    // Item pickups on the ground.
    for (const item of opts.groundItems || []) {
      const x = item.x * size;
      const y = item.y * size;
      ctx.fillStyle = '#e0b040';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a4010';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const sorted = entities.slice().sort((a, b) => a.y - b.y);
    for (const entity of sorted) {
      const x = (entity.x + (entity.offsetX || 0)) * size + size / 2;
      const y = (entity.y + (entity.offsetY || 0)) * size + size;
      drawPerson(ctx, entity.sprite, x, y, size * 1.05, entity.dir, entity.frame || 0);
    }

    ctx.restore();

    // Night tint.
    if (opts.night && !map.indoor) {
      ctx.fillStyle = 'rgba(20,26,60,0.34)';
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }
    if (map.cave) {
      const grd = ctx.createRadialGradient(
        this.viewWidth / 2, this.viewHeight / 2, 40,
        this.viewWidth / 2, this.viewHeight / 2, Math.max(this.viewWidth, this.viewHeight) * 0.6
      );
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }
  }
}

export { TILE_SIZE, TILES, rngFromString };
