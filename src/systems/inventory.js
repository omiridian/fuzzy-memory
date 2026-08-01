// The bag and the money that goes with it.

import { getItem, itemsInCategory, sellPrice } from '../data/items.js';

export const POCKETS = [
  { id: 'capture', name: 'Orbs', categories: ['capture'] },
  { id: 'medicine', name: 'Medicine', categories: ['heal', 'status'] },
  { id: 'battle', name: 'Battle', categories: ['battle'] },
  { id: 'field', name: 'Field', categories: ['field', 'training', 'evolution'] },
  { id: 'held', name: 'Held', categories: ['held'] },
  { id: 'tome', name: 'Tomes', categories: ['tome'] },
  { id: 'treasure', name: 'Valuables', categories: ['treasure'] },
  { id: 'key', name: 'Key Items', categories: ['key'] },
];

export function pocketOf(itemId) {
  const item = getItem(itemId);
  if (!item) return 'treasure';
  const pocket = POCKETS.find((p) => p.categories.includes(item.category));
  return pocket ? pocket.id : 'treasure';
}

export class Bag {
  constructor(money = 3000) {
    this.money = money;
    this.items = {}; // itemId -> count
  }

  add(itemId, qty = 1) {
    if (!getItem(itemId)) return 0;
    this.items[itemId] = (this.items[itemId] || 0) + qty;
    if (this.items[itemId] > 999) this.items[itemId] = 999;
    return this.items[itemId];
  }

  remove(itemId, qty = 1) {
    if (!this.items[itemId]) return false;
    this.items[itemId] -= qty;
    if (this.items[itemId] <= 0) delete this.items[itemId];
    return true;
  }

  count(itemId) {
    return this.items[itemId] || 0;
  }

  has(itemId, qty = 1) {
    return this.count(itemId) >= qty;
  }

  /** Item ids in a pocket, sorted by the data file's sort order. */
  pocket(pocketId) {
    return Object.keys(this.items)
      .filter((id) => pocketOf(id) === pocketId)
      .sort((a, b) => getItem(a).sort - getItem(b).sort);
  }

  /** Every pocket that currently has something in it. */
  usedPockets() {
    return POCKETS.filter((p) => this.pocket(p.id).length > 0);
  }

  canAfford(cost) {
    return this.money >= cost;
  }

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.money -= amount;
    return true;
  }

  earn(amount) {
    this.money = Math.min(9999999, this.money + Math.max(0, Math.floor(amount)));
    return this.money;
  }

  /** Buys `qty` of an item, returning the amount actually bought. */
  buy(itemId, qty = 1) {
    const item = getItem(itemId);
    if (!item || !item.price) return 0;
    const affordable = Math.min(qty, Math.floor(this.money / item.price));
    if (affordable <= 0) return 0;
    this.spend(item.price * affordable);
    this.add(itemId, affordable);
    return affordable;
  }

  /** Sells `qty` of an item, returning the money received. */
  sell(itemId, qty = 1) {
    const item = getItem(itemId);
    if (!item || item.key || !this.has(itemId)) return 0;
    const amount = Math.min(qty, this.count(itemId));
    const value = sellPrice(itemId) * amount;
    this.remove(itemId, amount);
    this.earn(value);
    return value;
  }

  serialize() {
    return { money: this.money, items: { ...this.items } };
  }

  static deserialize(data) {
    const bag = new Bag(data.money || 0);
    bag.items = { ...(data.items || {}) };
    return bag;
  }
}

export { getItem, itemsInCategory, sellPrice };
