// Abilities are passive traits with hooks the battle engine calls at fixed
// points. Every hook is optional; the engine guards each call.
//
// Hook reference (all receive one context object):
//   onSwitchIn({ battle, mon })                  – entry effects
//   onStatMod({ mon, stat, value, battle })      – return a replacement value
//   onModifyAttack({ battle, user, target, move, power })   – return new power
//   onModifyDamageDealt({ battle, user, target, move, mult, effectiveness })
//   onModifyDamageTaken({ battle, user, target, move, mult, effectiveness })
//   onTryHitImmunity({ battle, user, target, move })  – return truthy to absorb
//   onAfterDamage({ battle, user, target, move, damage })
//   onStatusAttempt({ battle, mon, status, source })  – return false to block
//   onEndTurn({ battle, mon })
//   onModifyAccuracy({ battle, user, target, move, accuracy })
//   onModifyCritStage({ battle, user, move, stage })
//   onModifyPriority({ battle, user, move, priority })
//   onFaint({ battle, mon, source })
//   onCapture({ rate })                          – field effect on catch rate
//   onEncounter({ rng, level })                  – field effect on encounters

const A = {};

/** Registers an ability. */
function ability(id, name, desc, hooks = {}, extra = {}) {
  A[id] = { id, name, desc, hooks, ...extra };
  return A[id];
}

const boost = (mult) => mult;

// ── Weather and terrain setters ────────────────────────────────────────────
ability('kindler', 'Kindler', 'Summons harsh sunlight on entry.', {
  onSwitchIn: ({ battle, mon }) => battle.setWeather('sun', 5, mon),
});
ability('cloudcaller', 'Cloudcaller', 'Summons rain on entry.', {
  onSwitchIn: ({ battle, mon }) => battle.setWeather('rain', 5, mon),
});
ability('duststorm', 'Duststorm', 'Kicks up a sandstorm on entry.', {
  onSwitchIn: ({ battle, mon }) => battle.setWeather('sand', 5, mon),
});
ability('snowmaker', 'Snowmaker', 'Calls down hail on entry.', {
  onSwitchIn: ({ battle, mon }) => battle.setWeather('hail', 5, mon),
});
ability('weaveshift', 'Weaveshift', 'Frays the Weave on entry, distorting the field.', {
  onSwitchIn: ({ battle, mon }) => battle.setTerrain('frayed', 5, mon),
});

// ── Weather riders ─────────────────────────────────────────────────────────
ability('sunsoak', 'Sunsoak', 'Speed doubles in sunlight.', {
  onStatMod: ({ battle, stat, value }) =>
    stat === 'spe' && battle.weather === 'sun' ? value * 2 : value,
});
ability('rainrunner', 'Rainrunner', 'Speed doubles in rain.', {
  onStatMod: ({ battle, stat, value }) =>
    stat === 'spe' && battle.weather === 'rain' ? value * 2 : value,
});
ability('snowcoat', 'Snowcoat', 'Defense rises by half during hail.', {
  onStatMod: ({ battle, stat, value }) =>
    stat === 'def' && battle.weather === 'hail' ? value * 1.5 : value,
});
ability('sandveil', 'Sandveil', 'Harder to hit in a sandstorm.', {
  onModifyAccuracy: ({ battle, accuracy }) => (battle.weather === 'sand' ? accuracy * 0.8 : accuracy),
});
ability('drylung', 'Drylung', 'Immune to sandstorm and hail chip damage.', {}, { weatherProof: true });

// ── Elemental absorbers ────────────────────────────────────────────────────
function absorber(id, name, type, effect) {
  ability(id, name, `Absorbs ${type} moves instead of taking damage.`, {
    onTryHitImmunity: ({ battle, target, move }) => {
      if (move.type !== type || move.category === 'status') return false;
      effect(battle, target);
      return true;
    },
  });
}
absorber('flamedrink', 'Flamedrink', 'ember', (b, m) => {
  b.log(`${m.name} drinks the flame!`);
  b.boostStat(m, 'spa', 1);
});
absorber('waterwell', 'Waterwell', 'tide', (b, m) => {
  b.log(`${m.name} soaks it up!`);
  b.heal(m, Math.floor(m.stats.hp / 4));
});
absorber('rootfeed', 'Rootfeed', 'verdant', (b, m) => {
  b.log(`${m.name} feeds on the growth!`);
  b.boostStat(m, 'atk', 1);
});
absorber('conductor', 'Conductor', 'volt', (b, m) => {
  b.log(`${m.name} channels the current!`);
  b.boostStat(m, 'spe', 1);
});
absorber('coldblooded', 'Coldblooded', 'frost', (b, m) => {
  b.log(`${m.name} settles into the chill.`);
  b.heal(m, Math.floor(m.stats.hp / 4));
});
absorber('shadeeater', 'Shade-Eater', 'umbra', (b, m) => {
  b.log(`${m.name} swallows the shadow!`);
  b.boostStat(m, 'spd', 1);
});
absorber('prismskin', 'Prismskin', 'radiant', (b, m) => {
  b.log(`${m.name} refracts the light!`);
  b.boostStat(m, 'spa', 1);
});

// ── Damage modifiers ───────────────────────────────────────────────────────
ability('overgrow', 'Overgrow', 'Verdant moves hit harder when badly hurt.', {
  onModifyDamageDealt: ({ user, move, mult }) =>
    move.type === 'verdant' && user.hp <= user.stats.hp / 3 ? mult * 1.5 : mult,
});
ability('blaze', 'Blaze', 'Ember moves hit harder when badly hurt.', {
  onModifyDamageDealt: ({ user, move, mult }) =>
    move.type === 'ember' && user.hp <= user.stats.hp / 3 ? mult * 1.5 : mult,
});
ability('torrent', 'Torrent', 'Tide moves hit harder when badly hurt.', {
  onModifyDamageDealt: ({ user, move, mult }) =>
    move.type === 'tide' && user.hp <= user.stats.hp / 3 ? mult * 1.5 : mult,
});
ability('swarmcall', 'Swarmcall', 'Insect moves hit harder when badly hurt.', {
  onModifyDamageDealt: ({ user, move, mult }) =>
    move.type === 'insect' && user.hp <= user.stats.hp / 3 ? mult * 1.5 : mult,
});
ability('lastember', 'Last Ember', 'All moves gain power below a third HP.', {
  onModifyDamageDealt: ({ user, mult }) => (user.hp <= user.stats.hp / 3 ? mult * 1.3 : mult),
});
ability('bruiser', 'Bruiser', 'Contact moves deal 30% more damage.', {
  onModifyDamageDealt: ({ move, mult }) => (move.contact ? mult * 1.3 : mult),
});
ability('sniper', 'Sniper', 'Critical hits deal extra damage.', {
  onModifyDamageDealt: ({ battle, mult }) => (battle.lastCrit ? mult * 1.5 : mult),
});
ability('keeneye', 'Keen Eye', 'Critical hits land far more often.', {
  onModifyCritStage: ({ stage }) => stage + 2,
});
ability('technician', 'Technician', 'Weak moves (60 power or less) gain 50%.', {
  onModifyAttack: ({ power }) => (power <= 60 ? Math.floor(power * 1.5) : power),
});
ability('heavyhitter', 'Heavy Hitter', 'Moves of 100+ power gain 20%, but accuracy drops.', {
  onModifyAttack: ({ power }) => (power >= 100 ? Math.floor(power * 1.2) : power),
  onModifyAccuracy: ({ move, accuracy }) => (move.power >= 100 ? accuracy * 0.9 : accuracy),
});
ability('adaptive', 'Adaptive', 'Same-type bonus is stronger.', {}, { stabBonus: 2 });
ability('scrapper', 'Scrapper', 'Ignores immunities from Spirit types.', {}, { ignoresImmunity: 'spirit' });
ability('filter', 'Filter', 'Super-effective hits are softened.', {
  onModifyDamageTaken: ({ effectiveness, mult }) => (effectiveness > 1 ? mult * 0.75 : mult),
});
ability('thickhide', 'Thick Hide', 'Takes 20% less damage from everything.', {
  onModifyDamageTaken: ({ mult }) => mult * 0.8,
});
ability('glasscannon', 'Glass Cannon', 'Deals 30% more damage and takes 20% more.', {
  onModifyDamageDealt: ({ mult }) => mult * 1.3,
  onModifyDamageTaken: ({ mult }) => mult * 1.2,
});
ability('fluffy', 'Fluffy', 'Halves contact damage but doubles Ember damage taken.', {
  onModifyDamageTaken: ({ move, mult }) => {
    if (move.type === 'ember') return mult * 2;
    return move.contact ? mult * 0.5 : mult;
  },
});
ability('ironwall', 'Iron Wall', 'Physical hits are cut by a third.', {
  onModifyDamageTaken: ({ move, mult }) => (move.category === 'physical' ? mult * 0.67 : mult),
});
ability('mirrorcoat', 'Mirror Coat', 'Special hits are cut by a third.', {
  onModifyDamageTaken: ({ move, mult }) => (move.category === 'special' ? mult * 0.67 : mult),
});

// ── Contact and retaliation ────────────────────────────────────────────────
ability('barbskin', 'Barbskin', 'Attackers who make contact lose an eighth of their HP.', {
  onAfterDamage: ({ battle, user, target, move }) => {
    if (move.contact && user.hp > 0) {
      battle.log(`${user.name} is pricked by ${target.name}'s barbs!`);
      battle.damage(user, Math.max(1, Math.floor(user.stats.hp / 8)), 'barbskin');
    }
  },
});
ability('cinderskin', 'Cinderskin', 'Contact may burn the attacker.', {
  onAfterDamage: ({ battle, user, move }) => {
    if (move.contact && battle.rng.percent(30)) battle.applyStatus(user, 'burn');
  },
});
ability('staticfield', 'Static Field', 'Contact may paralyse the attacker.', {
  onAfterDamage: ({ battle, user, move }) => {
    if (move.contact && battle.rng.percent(30)) battle.applyStatus(user, 'paralysis');
  },
});
ability('toxicskin', 'Toxic Skin', 'Contact may poison the attacker.', {
  onAfterDamage: ({ battle, user, move }) => {
    if (move.contact && battle.rng.percent(30)) battle.applyStatus(user, 'poison');
  },
});
ability('cursedtouch', 'Cursed Touch', 'Contact saps the attacker into the Weave.', {
  onAfterDamage: ({ battle, user, move }) => {
    if (move.contact && battle.rng.percent(25)) battle.applyStatus(user, 'fray');
  },
});
ability('grudge', 'Grudge', 'On fainting, cuts the attacker’s Attack sharply.', {
  onFaint: ({ battle, source }) => {
    if (source) battle.boostStat(source, 'atk', -2, 'a lingering grudge');
  },
});
ability('lastlaugh', 'Last Laugh', 'On fainting, deals a quarter of the attacker’s HP.', {
  onFaint: ({ battle, mon, source }) => {
    if (source && source.hp > 0) {
      battle.log(`${mon.name} bursts as it falls!`);
      battle.damage(source, Math.max(1, Math.floor(source.stats.hp / 4)), 'lastlaugh');
    }
  },
});

// ── Status control ─────────────────────────────────────────────────────────
function immunity(id, name, status, label) {
  ability(id, name, `Cannot be ${label}.`, {
    onStatusAttempt: ({ battle, mon, status: s }) => {
      if (s !== status) return true;
      battle.log(`${mon.name}'s ${name} prevents it!`);
      return false;
    },
  });
}
immunity('waterveil', 'Water Veil', 'burn', 'burned');
immunity('immunity', 'Immunity', 'poison', 'poisoned');
immunity('limber', 'Limber', 'paralysis', 'paralysed');
immunity('insomnia', 'Insomnia', 'sleep', 'put to sleep');
immunity('magmaheart', 'Magma Heart', 'freeze', 'frozen');
ability('purebody', 'Pure Body', 'Immune to every status condition.', {
  onStatusAttempt: ({ battle, mon }) => {
    battle.log(`${mon.name}'s Pure Body keeps it clear!`);
    return false;
  },
});
ability('shedskin', 'Shed Skin', 'May shrug off status at the end of a turn.', {
  onEndTurn: ({ battle, mon }) => {
    if (mon.status && battle.rng.percent(33)) battle.cureStatus(mon, 'sheds its skin');
  },
});
ability('naturalcure', 'Natural Cure', 'Heals status when withdrawn.', {}, { cureOnSwitch: true });
ability('guts', 'Guts', 'Attack rises by half while statused.', {
  onStatMod: ({ mon, stat, value }) => (stat === 'atk' && mon.status ? value * 1.5 : value),
});
ability('marvelhide', 'Marvel Hide', 'Defense rises by half while statused.', {
  onStatMod: ({ mon, stat, value }) => (stat === 'def' && mon.status ? value * 1.5 : value),
});
ability('poisonheal', 'Poison Heal', 'Poison heals instead of hurting.', {}, { poisonHeals: true });
ability('toxicboost', 'Toxic Boost', 'Poison moves never miss and land harder.', {
  onModifyAccuracy: ({ move, accuracy }) => (move.type === 'toxin' ? 999 : accuracy),
});

// ── Stat and field manipulation ────────────────────────────────────────────
ability('intimidate', 'Intimidate', 'Lowers the opposing Attack on entry.', {
  onSwitchIn: ({ battle, mon }) => {
    const foe = battle.opponentOf(mon);
    if (foe) battle.boostStat(foe, 'atk', -1, `${mon.name}'s stare`);
  },
});
ability('unnerve', 'Unnerve', 'Lowers the opposing Sp. Atk on entry.', {
  onSwitchIn: ({ battle, mon }) => {
    const foe = battle.opponentOf(mon);
    if (foe) battle.boostStat(foe, 'spa', -1, `${mon.name}'s presence`);
  },
});
ability('download', 'Download', 'Reads the foe and raises its better attacking stat.', {
  onSwitchIn: ({ battle, mon }) => {
    const foe = battle.opponentOf(mon);
    if (!foe) return;
    battle.boostStat(mon, foe.stats.def <= foe.stats.spd ? 'atk' : 'spa', 1, 'a quick read');
  },
});
ability('momentum', 'Momentum', 'Speed climbs each turn it stays in.', {
  onEndTurn: ({ battle, mon }) => {
    if (!mon.flags.momentumUsed) mon.flags.momentumUsed = 0;
    if (mon.flags.momentumUsed < 3) {
      mon.flags.momentumUsed++;
      battle.boostStat(mon, 'spe', 1, 'building momentum');
    }
  },
});
ability('rally', 'Rally', 'Raises its highest stat when an ally falls.', {}, { rallyOnAllyFaint: true });
ability('clearmind', 'Clear Mind', 'Its stats cannot be lowered.', {}, { noStatDrops: true });
ability('mirrorarmor', 'Mirror Armor', 'Reflects stat drops back at the attacker.', {}, { reflectStatDrops: true });
ability('contrary', 'Contrary', 'Stat changes are inverted.', {}, { invertBoosts: true });
ability('unaware', 'Unaware', 'Ignores the foe’s stat changes.', {}, { ignoreBoosts: true });
ability('simple', 'Simple', 'Stat changes are doubled.', {}, { doubleBoosts: true });

// ── Speed, priority and turn order ─────────────────────────────────────────
ability('quickfoot', 'Quickfoot', 'Speed rises by half while statused.', {
  onStatMod: ({ mon, stat, value }) => (stat === 'spe' && mon.status ? value * 1.5 : value),
});
ability('prankster', 'Prankster', 'Status moves go first.', {
  onModifyPriority: ({ move, priority }) => (move.category === 'status' ? priority + 1 : priority),
});
ability('firststrike', 'First Strike', 'Moves at 60 power or less go first.', {
  onModifyPriority: ({ move, priority }) =>
    move.category !== 'status' && move.power <= 60 ? priority + 1 : priority,
});
ability('slowstart', 'Slow Start', 'Attack is halved for the first three turns.', {
  onStatMod: ({ battle, mon, stat, value }) =>
    stat === 'atk' && battle.turn - (mon.flags.enteredTurn || 0) < 3 ? value * 0.5 : value,
});
ability('stall', 'Stall', 'Always moves last, but recovers each turn.', {
  onModifyPriority: ({ priority }) => priority - 1,
  onEndTurn: ({ battle, mon }) => battle.heal(mon, Math.floor(mon.stats.hp / 16), true),
});

// ── Recovery and endurance ─────────────────────────────────────────────────
ability('regenerator', 'Regenerator', 'Recovers a third of its HP when withdrawn.', {}, { regenOnSwitch: true });
ability('photosynth', 'Photosynth', 'Recovers HP in sunlight.', {
  onEndTurn: ({ battle, mon }) => {
    if (battle.weather === 'sun') battle.heal(mon, Math.floor(mon.stats.hp / 8), true);
  },
});
ability('raindrink', 'Raindrink', 'Recovers HP in the rain.', {
  onEndTurn: ({ battle, mon }) => {
    if (battle.weather === 'rain') battle.heal(mon, Math.floor(mon.stats.hp / 8), true);
  },
});
ability('icebody', 'Ice Body', 'Recovers HP during hail.', {
  onEndTurn: ({ battle, mon }) => {
    if (battle.weather === 'hail') battle.heal(mon, Math.floor(mon.stats.hp / 8), true);
  },
});
ability('sturdy', 'Sturdy', 'Survives a knockout blow from full HP with 1 HP.', {}, { endures: true });
ability('multiscale', 'Multiscale', 'Takes half damage while at full HP.', {
  onModifyDamageTaken: ({ target, mult }) => (target.hp === target.stats.hp ? mult * 0.5 : mult),
});
ability('leech', 'Leech', 'Drains a little HP from the foe each turn.', {
  onEndTurn: ({ battle, mon }) => {
    const foe = battle.opponentOf(mon);
    if (foe && foe.hp > 0) {
      const amount = Math.max(1, Math.floor(foe.stats.hp / 16));
      battle.damage(foe, amount, 'leech');
      battle.heal(mon, amount, true);
      battle.log(`${mon.name} drains a little from ${foe.name}.`);
    }
  },
});

// ── Accuracy and evasion ───────────────────────────────────────────────────
ability('deadeye', 'Dead Eye', 'Its moves never miss.', {
  onModifyAccuracy: () => 999,
});
ability('slipstream', 'Slipstream', 'Incoming moves are less accurate.', {}, { evasionAura: 0.9 });
ability('compound', 'Compound Eyes', 'Accuracy rises by 30%.', {
  onModifyAccuracy: ({ accuracy }) => accuracy * 1.3,
});

// ── Field / overworld abilities ────────────────────────────────────────────
ability('honeylure', 'Honeylure', 'Wild encounters happen more often.', {}, { encounterRate: 1.5 });
ability('stealthstep', 'Stealth Step', 'Wild encounters happen less often.', {}, { encounterRate: 0.5 });
ability('charmer', 'Charmer', 'Wild creatures are easier to catch.', { onCapture: ({ rate }) => rate * 1.3 });
ability('prospector', 'Prospector', 'Finds more money after battle.', {}, { moneyBonus: 1.5 });
ability('forager', 'Forager', 'Sometimes finds an item after battle.', {}, { forages: true });
ability('luckyfoot', 'Lucky Foot', 'Rarer creatures appear in the wild.', {}, { rareBonus: 2 });
ability('pathfinder', 'Pathfinder', 'The party moves faster in the field.', {}, { walkSpeed: 1.4 });

// ── Signature / legendary abilities ────────────────────────────────────────
ability('weavebound', 'Weavebound', 'Chaos moves ignore resistances entirely.', {
  onModifyDamageDealt: ({ move, mult, effectiveness }) =>
    move.type === 'chaos' && effectiveness < 1 ? mult / effectiveness : mult,
});
ability('worldroot', 'Worldroot', 'Heals itself and cures status every third turn.', {
  onEndTurn: ({ battle, mon }) => {
    if (battle.turn % 3 === 0) {
      battle.heal(mon, Math.floor(mon.stats.hp / 6), true);
      if (mon.status) battle.cureStatus(mon, 'draws on the worldroot');
    }
  },
});
ability('dawnbringer', 'Dawnbringer', 'Radiant moves gain power and pierce Umbra.', {
  onModifyDamageDealt: ({ move, mult }) => (move.type === 'radiant' ? mult * 1.3 : mult),
});
ability('nightmantle', 'Nightmantle', 'Untargetable by super-effective moves once per battle.', {}, { nightGuard: true });
ability('sovereign', 'Sovereign', 'Immune to stat drops and status, but takes 10% more damage.', {
  onStatusAttempt: ({ battle, mon }) => {
    battle.log(`${mon.name} is beyond such things.`);
    return false;
  },
  onModifyDamageTaken: ({ mult }) => mult * 1.1,
}, { noStatDrops: true });
ability('devourer', 'Devourer', 'Knocking out a foe restores half its HP.', {}, { devours: true });
ability('unravel', 'Unravel', 'Halves the foe’s Defense on entry.', {
  onSwitchIn: ({ battle, mon }) => {
    const foe = battle.opponentOf(mon);
    if (foe) battle.boostStat(foe, 'def', -2, `${mon.name}'s unravelling gaze`);
  },
});

export const ABILITIES = A;
export const ABILITY_IDS = Object.keys(A);

export function getAbility(id) {
  return A[id] || null;
}

/** Reads a static ability property, e.g. `abilityFlag(mon, 'endures')`. */
export function abilityFlag(mon, key) {
  const ab = mon && mon.ability ? A[mon.ability] : null;
  if (!ab) return undefined;
  return ab[key];
}

/** Calls an ability hook if present, returning the hook's result. */
export function callAbility(mon, hook, ctx) {
  if (!mon || !mon.ability || mon.abilitySuppressed) return undefined;
  const ab = A[mon.ability];
  if (!ab || !ab.hooks[hook]) return undefined;
  return ab.hooks[hook]({ ...ctx, mon });
}
