// Where the guild ledger is kept.
//
// Local storage, and only local storage. The artifact runtime offers a shared
// document store, but a store shared by every viewer is the wrong shape for
// this game: two people opening the same link would fight over one guild, one
// roster and one wall of the dead. Per-viewer private storage there needs a
// capability this page cannot have, and declaring the store at all would stop
// the page being shared. So each browser keeps its own ledger, which is what a
// single-player roguelike wants anyway.
//
// Everything here is best-effort: a private window that refuses storage gets a
// game that plays perfectly and forgets afterwards, rather than no game.

import { loadGuild, saveGuild } from './guild.js';

export class SaveSlot {
  constructor() {
    this.writable = true;
  }

  /** The guild in this browser, or null on a first visit. */
  read() {
    return loadGuild();
  }

  /** Returns false when the browser would not keep it. */
  write(guild) {
    this.writable = saveGuild(guild);
    return this.writable;
  }
}
