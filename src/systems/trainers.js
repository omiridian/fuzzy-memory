// Builds trainer teams. Entries may name a species directly or a habitat tag,
// which lets routes pull from the procedural roster while staying stable
// across saves (the seed comes from the trainer's name).

import { rngFromString } from '../core/rng.js';
import { DEX, speciesInHabitat, getSpecies } from '../data/species.js';
import { createMon, defaultMovesFor } from './monster.js';

/** Picks a plausible species for a habitat at a given level. */
function pickForHabitat(tag, level, rng) {
  const pool = speciesInHabitat(tag).filter((s) => !s.legendary);
  if (!pool.length) return 'nibbet';
  // Prefer forms whose evolution level has already passed.
  const suitable = pool.filter((s) => {
    if (s.stage === 1) return level <= 26;
    if (s.stage === 2) return level >= 14;
    return level >= 30;
  });
  const list = suitable.length ? suitable : pool;
  return rng.pick(list).id;
}

/**
 * @param {object} trainer  { name, team: [{species|habitat, level, moves, item, ability}] }
 * @returns {Array} party
 */
export function buildTrainerTeam(trainer) {
  const rng = rngFromString('trainer:' + trainer.name);
  const party = [];
  for (const entry of trainer.team || []) {
    const speciesId =
      entry.species && DEX[entry.species] ? entry.species : pickForHabitat(entry.habitat || 'grass_early', entry.level, rng);
    const mon = createMon(speciesId, entry.level, {
      rng,
      moves: entry.moves || defaultMovesFor(speciesId, entry.level),
      held: entry.item || null,
      ability: entry.ability || null,
      friendship: 120,
      originalTrainer: trainer.name,
    });
    if (entry.nickname) mon.nickname = entry.nickname;
    party.push(mon);
  }
  if (!party.length) party.push(createMon('nibbet', 5, { rng }));
  return party;
}

/** A short label for the battle intro card. */
export function trainerLabel(trainer) {
  return trainer.title ? `${trainer.title} ${trainer.name}` : trainer.name;
}

export { getSpecies };
