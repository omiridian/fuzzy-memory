// The camera. Converts between world pixels and screen pixels, and knows how to
// follow a party that keeps wandering off.

import { clamp, lerp } from '../core/util.js';
import { ROOM_PX } from '../systems/grid.js';

export class Camera {
  constructor(viewport) {
    this.x = ROOM_PX / 2;
    this.y = ROOM_PX / 2;
    this.zoom = 1.25;
    this.targetZoom = 1.25;
    this.follow = true;
    this.viewport = viewport;
    this.shake = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  setViewport(viewport) {
    this.viewport = viewport;
  }

  update(dt, focus) {
    this.zoom = lerp(this.zoom, this.targetZoom, Math.min(1, dt * 7));
    if (this.follow && focus) {
      this.x = lerp(this.x, focus.x, Math.min(1, dt * 2.6));
      this.y = lerp(this.y, focus.y, Math.min(1, dt * 2.6));
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      this.offsetX = (Math.random() - 0.5) * this.shake * 9;
      this.offsetY = (Math.random() - 0.5) * this.shake * 9;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  pan(dx, dy) {
    this.follow = false;
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
  }

  zoomBy(delta, aroundScreen) {
    const before = aroundScreen ? this.toWorld(aroundScreen.x, aroundScreen.y) : null;
    this.targetZoom = clamp(this.targetZoom * (delta > 0 ? 0.88 : 1.13), 0.45, 2.4);
    this.zoom = this.targetZoom;
    if (before) {
      const after = this.toWorld(aroundScreen.x, aroundScreen.y);
      this.x += before.x - after.x;
      this.y += before.y - after.y;
      this.follow = false;
    }
  }

  /** Applies the camera to a context; caller must restore. */
  apply(ctx) {
    const v = this.viewport;
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, v.h);
    ctx.clip();
    ctx.translate(v.x + v.w / 2 + this.offsetX, v.y + v.h / 2 + this.offsetY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  toScreen(wx, wy) {
    const v = this.viewport;
    return {
      x: v.x + v.w / 2 + this.offsetX + (wx - this.x) * this.zoom,
      y: v.y + v.h / 2 + this.offsetY + (wy - this.y) * this.zoom,
    };
  }

  toWorld(sx, sy) {
    const v = this.viewport;
    return {
      x: (sx - v.x - v.w / 2 - this.offsetX) / this.zoom + this.x,
      y: (sy - v.y - v.h / 2 - this.offsetY) / this.zoom + this.y,
    };
  }

  visible(wx, wy, w, h) {
    const p = this.toScreen(wx, wy);
    const v = this.viewport;
    const sw = w * this.zoom;
    const sh = h * this.zoom;
    return p.x + sw > v.x - 40 && p.x < v.x + v.w + 40 && p.y + sh > v.y - 40 && p.y < v.y + v.h + 40;
  }
}
