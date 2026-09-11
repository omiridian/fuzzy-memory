// Turning raw pointer events into the handful of gestures the game needs.
//
// One recogniser serves mouse, pen and touch. Mouse keeps its buttons and its
// wheel; a finger gets tap, long-press (which stands in for right-click), drag
// and pinch. Scenes never see a raw touch — they see the same small vocabulary
// either way.

const TAP_SLOP = 10; // px of movement still counted as a tap
const LONG_PRESS = 420; // ms before a press becomes a right-click
const PINCH_SLOP = 8;

export class Gestures {
  /**
   * `handlers` is the scene-facing vocabulary:
   *   move(x, y)            pointer moved with nothing held
   *   press(x, y, button)   a click, a tap, or a long-press (button 2)
   *   release(x, y, button)
   *   panStart(x, y) -> 'pan' | 'scroll' | null
   *   pan(dx, dy, kind)
   *   panEnd(kind)
   *   zoom(factor, x, y)
   *   longPressStart(x, y)  a hint that a long-press is about to fire
   */
  constructor(handlers) {
    this.h = handlers;
    this.points = new Map();
    this.mode = null; // null | 'press' | 'pan' | 'scroll' | 'pinch'
    this.panKind = null;
    this.longPressTimer = null;
    this.pinchDistance = 0;
    this.pinchCentre = { x: 0, y: 0 };
    this.lastTouchAt = 0;
  }

  /** True when the player has used a finger recently — changes affordances. */
  get touching() {
    return this.lastTouchAt > 0 && Date.now() - this.lastTouchAt < 60000;
  }

  down(id, x, y, button, isTouch) {
    if (isTouch) this.lastTouchAt = Date.now();
    this.points.set(id, { x, y, startX: x, startY: y, at: Date.now(), isTouch, button, moved: false });

    if (this.points.size === 2) {
      this.cancelLongPress();
      const [a, b] = [...this.points.values()];
      this.mode = 'pinch';
      this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchCentre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return;
    }
    if (this.points.size > 2) return;

    if (!isTouch) {
      // A mouse says what it means straight away.
      this.mode = 'press';
      this.h.move(x, y);
      if (button === 1) {
        this.mode = 'pan';
        this.panKind = 'pan';
        return;
      }
      this.h.press(x, y, button);
      return;
    }

    // A finger waits to find out what it is.
    this.mode = 'press';
    this.h.move(x, y);
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      const p = this.points.get(id);
      if (!p || p.moved || this.mode !== 'press') return;
      this.mode = 'longpress';
      if (this.h.longPressStart) this.h.longPressStart(p.x, p.y);
      this.h.press(p.x, p.y, 2);
      this.h.release(p.x, p.y, 2);
    }, LONG_PRESS);
  }

  move(id, x, y) {
    const p = this.points.get(id);
    if (!p) {
      if (!this.points.size) this.h.move(x, y);
      return;
    }
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    if (Math.hypot(x - p.startX, y - p.startY) > TAP_SLOP) p.moved = true;

    if (this.mode === 'pinch') {
      if (this.points.size < 2) return;
      const [a, b] = [...this.points.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.pinchDistance > PINCH_SLOP && distance > PINCH_SLOP) {
        this.h.zoom(distance / this.pinchDistance, centre.x, centre.y);
      }
      // Two fingers sliding together move the map as well as scale it.
      this.h.pan(centre.x - this.pinchCentre.x, centre.y - this.pinchCentre.y, 'pan');
      this.pinchDistance = distance;
      this.pinchCentre = centre;
      return;
    }

    if (this.mode === 'press' && p.moved) {
      this.cancelLongPress();
      const kind = this.h.panStart ? this.h.panStart(p.startX, p.startY) : null;
      if (kind) {
        this.mode = 'pan';
        this.panKind = kind;
      } else {
        this.mode = 'dead';
      }
    }

    if (this.mode === 'pan') {
      this.h.pan(dx, dy, this.panKind);
      return;
    }
    if (!p.isTouch) this.h.move(x, y);
  }

  up(id, x, y, button) {
    const p = this.points.get(id);
    this.points.delete(id);
    this.cancelLongPress();
    if (!p) return;

    if (this.mode === 'pinch') {
      // The second finger leaving should not fire a tap with the first.
      if (this.points.size < 2) this.mode = this.points.size ? 'dead' : null;
      return;
    }
    if (this.mode === 'pan') {
      if (this.h.panEnd) this.h.panEnd(this.panKind);
      if (!p.isTouch) this.h.release(x, y, button);
      this.mode = this.points.size ? this.mode : null;
      this.panKind = null;
      return;
    }
    if (this.mode === 'press') {
      if (p.isTouch) {
        // A tap is a click that also has to stand in for a hover.
        this.h.move(p.x, p.y);
        this.h.press(p.x, p.y, 0);
        this.h.release(p.x, p.y, 0);
      } else {
        this.h.release(x, y, button);
      }
    }
    this.mode = this.points.size ? this.mode : null;
  }

  cancel(id) {
    this.points.delete(id);
    this.cancelLongPress();
    if (!this.points.size) {
      if (this.mode === 'pan' && this.h.panEnd) this.h.panEnd(this.panKind);
      this.mode = null;
    }
  }

  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}

/**
 * The logical drawing size for a given window. The game is drawn in its own
 * coordinate space and scaled to fill the screen, so this decides how much of
 * the dungeon fits and how big a button ends up under a thumb.
 */
export function logicalSize(viewWidth, viewHeight) {
  const aspect = viewWidth / Math.max(1, viewHeight);
  if (aspect < 1.15) {
    // Portrait, or close to it: keep one logical pixel near one CSS pixel so a
    // 44-unit button really is a 44-point touch target.
    const w = Math.round(Math.min(560, Math.max(340, viewWidth)));
    return { w, h: Math.round(w / aspect), compact: true };
  }
  const h = Math.round(Math.min(760, Math.max(400, viewHeight)));
  const w = Math.round(h * aspect);
  return { w, h, compact: w < 720 };
}
