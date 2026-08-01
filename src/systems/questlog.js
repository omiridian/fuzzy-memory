// The quest log. Quests advance off game flags, so anything that sets a flag
// — a script, a won battle, a picked-up item — can move the story along.

import { QUESTS, QUEST_IDS, getQuest } from '../data/quests.js';

export class QuestLog {
  constructor(game) {
    this.game = game;
    this.active = {}; // questId -> { steps: {stepId: true}, done: bool, notified: bool }
    this.completed = [];
  }

  /** Starts a quest if it is not already tracked. */
  start(questId) {
    const quest = getQuest(questId);
    if (!quest || this.active[questId] || (this.completed.includes(questId) && !quest.repeatable)) {
      return false;
    }
    this.active[questId] = { steps: {}, done: false };
    this.sync(questId);
    return true;
  }

  isActive(questId) {
    return !!this.active[questId] && !this.active[questId].done;
  }

  isComplete(questId) {
    return this.completed.includes(questId);
  }

  /** Auto-starting quests come online as soon as the game does. */
  startAuto() {
    for (const id of QUEST_IDS) {
      if (QUESTS[id].autoStart) this.start(id);
    }
  }

  /**
   * Re-checks every tracked quest against the current flags.
   * Returns the quests that completed on this call.
   */
  refresh() {
    const finished = [];
    for (const questId in this.active) {
      if (this.active[questId].done) continue;
      if (this.sync(questId)) finished.push(getQuest(questId));
    }
    return finished;
  }

  /** Updates one quest's steps; returns true if it completed just now. */
  sync(questId) {
    const quest = getQuest(questId);
    const state = this.active[questId];
    if (!quest || !state || state.done) return false;
    let all = true;
    for (const step of quest.steps) {
      if (this.game.getFlag(step.flag)) state.steps[step.id] = true;
      else all = false;
    }
    if (all && quest.steps.length) {
      state.done = true;
      if (!this.completed.includes(questId)) this.completed.push(questId);
      this.grant(quest);
      if (quest.nextQuest) this.start(quest.nextQuest);
      if (quest.repeatable) {
        delete this.active[questId];
        this.completed = this.completed.filter((id) => id !== questId);
      }
      return true;
    }
    return false;
  }

  grant(quest) {
    const reward = quest.reward || {};
    if (reward.money) this.game.bag.earn(reward.money);
    for (const entry of reward.items || []) {
      if (entry.qty > 0) this.game.bag.add(entry.item, entry.qty);
    }
  }

  /** Steps of a quest with their completion state, for the UI. */
  progress(questId) {
    const quest = getQuest(questId);
    const state = this.active[questId] || { steps: {} };
    return quest.steps.map((step) => ({
      text: step.text,
      done: !!state.steps[step.id] || this.completed.includes(questId),
    }));
  }

  activeList() {
    return Object.keys(this.active)
      .filter((id) => !this.active[id].done && !QUESTS[id].hidden)
      .map((id) => QUESTS[id])
      .sort((a, b) => (a.type === b.type ? (a.chapter || 99) - (b.chapter || 99) : a.type === 'main' ? -1 : 1));
  }

  completedList() {
    return this.completed.map((id) => QUESTS[id]).filter(Boolean);
  }

  /** The main-story quest currently in play, for the HUD. */
  currentMain() {
    return this.activeList().find((q) => q.type === 'main') || null;
  }

  serialize() {
    return { active: this.active, completed: this.completed };
  }

  load(data) {
    if (!data) return;
    this.active = data.active || {};
    this.completed = data.completed || [];
  }
}
