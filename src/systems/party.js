// The active party (up to six) and the storage terminal behind it.

import { isFainted, healFully, displayName } from './monster.js';
import { getSpecies } from '../data/species.js';

export const PARTY_MAX = 6;
export const BOX_COUNT = 16;
export const BOX_SIZE = 30;

export class Party {
  constructor(mons = []) {
    this.mons = mons;
  }

  get length() {
    return this.mons.length;
  }

  get(index) {
    return this.mons[index] || null;
  }

  find(uid) {
    return this.mons.find((m) => m.uid === uid) || null;
  }

  add(mon) {
    if (this.mons.length >= PARTY_MAX) return false;
    this.mons.push(mon);
    return true;
  }

  remove(index) {
    if (index < 0 || index >= this.mons.length) return null;
    return this.mons.splice(index, 1)[0];
  }

  swap(a, b) {
    if (a === b) return;
    const tmp = this.mons[a];
    this.mons[a] = this.mons[b];
    this.mons[b] = tmp;
  }

  isFull() {
    return this.mons.length >= PARTY_MAX;
  }

  healthy() {
    return this.mons.filter((m) => !isFainted(m));
  }

  isWiped() {
    return this.mons.length > 0 && this.healthy().length === 0;
  }

  /** The creature that leads the next battle. */
  lead() {
    return this.healthy()[0] || this.mons[0] || null;
  }

  leadIndex() {
    const index = this.mons.findIndex((m) => !isFainted(m));
    return index < 0 ? 0 : index;
  }

  healAll() {
    for (const mon of this.mons) healFully(mon);
  }

  highestLevel() {
    return this.mons.reduce((max, m) => Math.max(max, m.level), 1);
  }

  averageLevel() {
    if (!this.mons.length) return 1;
    return Math.round(this.mons.reduce((sum, m) => sum + m.level, 0) / this.mons.length);
  }

  serialize() {
    return this.mons;
  }
}

export class Storage {
  constructor() {
    this.boxes = [];
    for (let i = 0; i < BOX_COUNT; i++) {
      this.boxes.push({ name: `Box ${i + 1}`, mons: [] });
    }
  }

  /** Puts a creature in the first box with room. Returns the box index. */
  deposit(mon) {
    for (let i = 0; i < this.boxes.length; i++) {
      if (this.boxes[i].mons.length < BOX_SIZE) {
        this.boxes[i].mons.push(mon);
        return i;
      }
    }
    return -1;
  }

  withdraw(boxIndex, slot) {
    const box = this.boxes[boxIndex];
    if (!box || !box.mons[slot]) return null;
    return box.mons.splice(slot, 1)[0];
  }

  count() {
    return this.boxes.reduce((sum, box) => sum + box.mons.length, 0);
  }

  all() {
    return this.boxes.flatMap((box) => box.mons);
  }

  serialize() {
    return this.boxes;
  }

  static deserialize(data) {
    const storage = new Storage();
    if (Array.isArray(data)) {
      data.forEach((box, i) => {
        if (storage.boxes[i]) storage.boxes[i] = box;
      });
    }
    return storage;
  }
}

/** A compact one-line summary used across the menus. */
export function partyLine(mon) {
  const species = getSpecies(mon.species);
  return `${displayName(mon)}  Lv${mon.level}  ${mon.hp}/${mon.stats.hp}${
    mon.status ? ' ' + mon.status.toUpperCase().slice(0, 3) : ''
  }  ${species.types.join('/')}`;
}
