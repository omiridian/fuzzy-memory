// The hand of room cards. Small, and deliberately a bit cruel: you build with
// what you drew, not with what you wanted.

import { getCard, rotateDoors, rotationCount } from '../data/cards.js';

export const HAND_SIZE = 5;
export const DRAW_INTERVAL = 9; // seconds between free draws

let handSerial = 0;

export class Deck {
  constructor(cardIds, rng) {
    this.rng = rng;
    this.draw = rng.shuffle(cardIds.slice());
    this.discard = [];
    this.hand = [];
    this.drawTimer = DRAW_INTERVAL;
    this.placedCount = 0;
    this.uniquesPlaced = new Set();
  }

  get remaining() {
    return this.draw.length;
  }

  /** Reshuffles the discard back in when the draw pile runs out. */
  refill() {
    if (this.draw.length || !this.discard.length) return false;
    this.draw = this.rng.shuffle(this.discard);
    this.discard = [];
    return true;
  }

  drawOne() {
    if (this.hand.length >= HAND_SIZE) return null;
    this.refill();
    const id = this.draw.shift();
    if (!id) return null;
    handSerial += 1;
    const card = getCard(id);
    const entry = {
      uid: `hand_${handSerial}`,
      id,
      card,
      rotation: 0,
      rotations: rotationCount(card.doors),
      dealT: 1,
    };
    this.hand.push(entry);
    return entry;
  }

  fill() {
    const dealt = [];
    while (this.hand.length < HAND_SIZE) {
      const c = this.drawOne();
      if (!c) break;
      dealt.push(c);
    }
    return dealt;
  }

  tick(dt) {
    this.drawTimer -= dt;
    if (this.drawTimer <= 0) {
      this.drawTimer = DRAW_INTERVAL;
      return this.drawOne();
    }
    return null;
  }

  find(uid) {
    return this.hand.find((c) => c.uid === uid) || null;
  }

  rotate(uid, turns = 1) {
    const entry = this.find(uid);
    if (!entry) return null;
    entry.rotation = (entry.rotation + turns) % 4;
    return entry;
  }

  doorsOf(entry) {
    return rotateDoors(entry.card.doors, entry.rotation);
  }

  /**
   * Removes a card from hand because it has been built. Ordinary cards go to
   * the discard and come round again when the draw pile runs out; a unique room
   * — a boss vault — is gone for the rest of the expedition, because there is
   * only one of it.
   */
  consume(uid) {
    const i = this.hand.findIndex((c) => c.uid === uid);
    if (i < 0) return null;
    const [entry] = this.hand.splice(i, 1);
    this.placedCount += 1;
    if (entry.card.unique) {
      this.uniquesPlaced.add(entry.id);
      this.draw = this.draw.filter((id) => id !== entry.id);
      this.discard = this.discard.filter((id) => id !== entry.id);
    } else {
      this.discard.push(entry.id);
    }
    return entry;
  }

  /** Throws a card away without building it — the escape hatch when nothing fits. */
  mulligan(uid) {
    const i = this.hand.findIndex((c) => c.uid === uid);
    if (i < 0) return null;
    const [entry] = this.hand.splice(i, 1);
    this.discard.push(entry.id);
    const replacement = this.drawOne();
    return { discarded: entry, replacement };
  }

  /** Door masks currently available, for the "can anything be built?" check. */
  handMasks() {
    const masks = [];
    for (const entry of this.hand) {
      for (let turn = 0; turn < entry.rotations; turn++) {
        masks.push(rotateDoors(entry.card.doors, turn));
      }
    }
    return masks;
  }
}
