// Status effects. Everything that ticks, slows, shields or terrifies.

export const STATUS = {
  burn: { id: 'burn', name: 'Burning', dps: true, color: '#ff7a3c', icon: 'flame', hostile: true },
  poison: { id: 'poison', name: 'Poisoned', dps: true, color: '#8ed24f', icon: 'drop', hostile: true, stacks: 3 },
  rot: { id: 'rot', name: 'Rotting', dps: true, color: '#9a8f5c', icon: 'skull', hostile: true, healingMult: 0.6 },
  slow: { id: 'slow', name: 'Slowed', speedMult: true, color: '#7fd7ff', icon: 'snow', hostile: true },
  stun: { id: 'stun', name: 'Stunned', stunned: true, color: '#ffe479', icon: 'star', hostile: true },
  fear: { id: 'fear', name: 'Afraid', feared: true, color: '#b98fd0', icon: 'eye', hostile: true },
  marked: { id: 'marked', name: 'Marked', damageTaken: true, color: '#ff5f7a', icon: 'target', hostile: true },
  shield: { id: 'shield', name: 'Shielded', absorb: true, color: '#9fd8ff', icon: 'shield' },
  bless: { id: 'bless', name: 'Blessed', damageMult: true, color: '#ffe9a8', icon: 'sun' },
  regen: { id: 'regen', name: 'Mending', hps: true, color: '#8fe8a0', icon: 'leaf' },
  haste: { id: 'haste', name: 'Hasted', hasteMult: true, color: '#c8ffa0', icon: 'wing' },
};

export function getStatus(id) {
  const s = STATUS[id];
  if (!s) throw new Error(`unknown status: ${id}`);
  return s;
}
