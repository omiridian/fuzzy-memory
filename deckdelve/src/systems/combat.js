// Combat resolution. Deliberately arithmetic-only: no canvas, no timers of its
// own, so a whole fight can be simulated in a test in a millisecond.
//
// The player never casts anything here. Abilities pick their own moment.

import { STATUS } from '../data/status.js';
import { getAbility } from '../data/classes.js';
import { dist } from '../core/util.js';

/** Armour blunts rather than blocks, so nothing is ever fully immune. */
export function mitigate(amount, armor) {
  return Math.max(1, amount * (1 - Math.min(0.7, armor * 0.045)) - armor * 0.35);
}

export function statusPower(actor, id) {
  let total = 0;
  for (const s of actor.statuses) if (s.id === id) total += s.power;
  return total;
}

export function hasStatus(actor, id) {
  for (const s of actor.statuses) if (s.id === id) return true;
  return false;
}

export function applyStatus(actor, id, duration, power = 1, source = null) {
  const def = STATUS[id];
  if (!def || !actor.alive) return null;
  if (def.hostile) {
    const resist = actor.statusResist || 0;
    if (resist >= 1) return null;
    duration *= 1 - resist;
    if (duration <= 0.2) return null;
  }
  const existing = actor.statuses.find((s) => s.id === id);
  if (existing && !def.stacks) {
    existing.duration = Math.max(existing.duration, duration);
    existing.power = Math.max(existing.power, power);
    return existing;
  }
  if (existing && def.stacks) {
    const count = actor.statuses.filter((s) => s.id === id).length;
    if (count >= def.stacks) {
      existing.duration = Math.max(existing.duration, duration);
      return existing;
    }
  }
  const s = { id, duration, power, source: source ? source.id : null };
  actor.statuses.push(s);
  return s;
}

export function clearStatus(actor, id) {
  actor.statuses = actor.statuses.filter((s) => s.id !== id);
}

/** Multipliers currently riding on an actor, folded into one object. */
export function statusMods(actor) {
  let speed = 1;
  let damage = 1;
  let taken = 1;
  let stunned = false;
  let feared = false;
  for (const s of actor.statuses) {
    const def = STATUS[s.id];
    if (!def) continue;
    if (def.speedMult) speed *= 1 - s.power;
    if (def.hasteMult) speed *= 1 + s.power;
    if (def.damageMult) damage *= 1 + s.power;
    if (def.damageTaken) taken *= 1 + s.power;
    if (def.stunned) stunned = true;
    if (def.feared) feared = true;
  }
  return { speed: Math.max(0.2, speed), damage, taken, stunned, feared };
}

/** Ticks burn/poison/regen and expires anything that has run out. */
export function tickStatuses(actor, dt, world) {
  if (!actor.statuses.length) return;
  let chip = 0;
  let mend = 0;
  for (const s of actor.statuses) {
    const def = STATUS[s.id];
    s.duration -= dt;
    if (!def) continue;
    if (def.dps) chip += s.power * dt;
    if (def.hps) mend += s.power * dt;
  }
  actor.statuses = actor.statuses.filter((s) => s.duration > 0);
  if (chip > 0) applyDamage(null, actor, chip, world, { kind: 'tick', silent: true });
  if (mend > 0) healActor(actor, mend, world, { silent: true });
}

/**
 * The one place health goes down. `attacker` may be null (traps, burning,
 * ceilings). Returns what actually happened so the caller can narrate it.
 */
export function applyDamage(attacker, target, amount, world, opts = {}) {
  if (!target || !target.alive) return { dealt: 0, killed: false };

  const mods = statusMods(target);
  let raw = amount * mods.taken;
  if (opts.element === 'fire' && target.fireResist) raw *= 1 - target.fireResist;
  if (attacker) {
    const amods = statusMods(attacker);
    raw *= amods.damage;
  }

  let crit = false;
  if (!opts.noCrit && attacker && attacker.crit && Math.random() < attacker.crit) {
    crit = true;
    raw *= 1.85;
  }

  let dealt = opts.kind === 'tick' ? raw : mitigate(raw, target.armor || 0);

  // Shields eat damage before flesh does.
  const shield = target.statuses.find((s) => s.id === 'shield');
  if (shield && shield.power > 0) {
    const absorbed = Math.min(shield.power, dealt);
    shield.power -= absorbed;
    dealt -= absorbed;
    if (shield.power <= 0) clearStatus(target, 'shield');
  }

  if (dealt <= 0) return { dealt: 0, killed: false, crit };

  target.hp -= dealt;
  target.hitFlash = 0.18;
  if (world && world.floatText && !opts.silent) {
    world.floatText(target.x, target.y - 12, `-${Math.round(dealt)}`, crit ? '#ffdf6b' : '#ff9a8a');
  }

  if (target.hp <= 0) {
    target.hp = 0;
    if (world && world.kill) world.kill(target, attacker, opts);
    return { dealt, killed: true, crit };
  }
  return { dealt, killed: false, crit };
}

export function healActor(target, amount, world, opts = {}) {
  if (!target || !target.alive) return 0;
  let scale = 1;
  for (const s of target.statuses) {
    const def = STATUS[s.id];
    if (def && def.healingMult) scale *= def.healingMult;
  }
  if (opts.healingMult) scale *= opts.healingMult;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount * scale);
  const healed = target.hp - before;
  if (healed > 0.5 && world && world.floatText && !opts.silent) {
    world.floatText(target.x, target.y - 12, `+${Math.round(healed)}`, '#9ff0a8');
  }
  return healed;
}

/** A basic swing or shot. Ranged attackers throw a projectile instead. */
export function basicAttack(actor, target, world) {
  const mods = statusMods(actor);
  if (mods.stunned) return false;
  actor.swing = 0.18;
  actor.facing = target.x >= actor.x ? 1 : -1;

  const onHit = actor.onHit || null;
  if (actor.ranged) {
    world.spawnProjectile({
      kind: actor.projectile || 'bolt',
      x: actor.x,
      y: actor.y - 6,
      tx: target.x,
      ty: target.y - 4,
      owner: actor.id,
      side: actor.side,
      damage: actor.damage,
      targetId: target.id,
      onHit,
      element: actor.projectile === 'ember' ? 'fire' : null,
    });
    return true;
  }

  const res = applyDamage(actor, target, actor.damage, world);
  if (res.dealt > 0 && onHit && Math.random() < (onHit.chance || 1)) {
    applyStatus(target, onHit.status, onHit.duration, onHit.power, actor);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

function abilityReady(actor, id) {
  return (actor.cooldowns[id] || 0) <= 0;
}

export function tickCooldowns(actor, dt) {
  for (const id in actor.cooldowns) {
    if (actor.cooldowns[id] > 0) actor.cooldowns[id] -= dt;
  }
}

/**
 * Decides whether an ability should fire right now, and fires it. This is the
 * whole of "the player should not need to click spells": each ability has one
 * trigger and the AI honours it.
 */
export function tryAbilities(actor, world) {
  if (!actor.alive || !actor.abilities) return null;
  const mods = statusMods(actor);
  if (mods.stunned) return null;

  for (const abilityId of actor.abilities) {
    if (!abilityReady(actor, abilityId)) continue;
    const ability = getAbility(abilityId);
    const fired = evaluateAbility(actor, ability, world);
    if (fired) {
      actor.cooldowns[abilityId] = ability.cooldown;
      return { ability, ...fired };
    }
  }
  return null;
}

function evaluateAbility(actor, ability, world) {
  const foes = world.hostilesNear(actor, 150);
  const allies = world.alliesNear(actor, 150);

  switch (ability.trigger) {
    case 'enemies_near': {
      const anchor = ability.fromSelf === false ? pickCluster(foes, ability.radius) : actor;
      if (!anchor) return null;
      const hit = foes.filter((f) => dist(f.x, f.y, anchor.x, anchor.y) <= ability.radius);
      if (hit.length < (ability.minTargets || 1)) return null;
      for (const foe of hit) {
        applyDamage(actor, foe, actor.damage * (ability.damageMult || 1), world);
        if (ability.status) applyStatus(foe, ability.status, ability.duration, ability.power, actor);
      }
      world.burst(anchor.x, anchor.y, ability.radius, actor.color || '#fff');
      return { targets: hit, text: `${ability.text} ${hit.length} of them` };
    }
    case 'self_hurt': {
      if (actor.hp / actor.maxHp > (ability.threshold || 0.5)) return null;
      if (!foes.length) return null;
      applyStatus(actor, ability.status, ability.duration, ability.power, actor);
      return { targets: [actor], text: ability.text };
    }
    case 'ally_hurt': {
      let worst = null;
      for (const a of allies.concat([actor])) {
        if (!a.alive) continue;
        if (a.hp / a.maxHp > (ability.threshold || 0.7)) continue;
        if (!worst || a.hp / a.maxHp < worst.hp / worst.maxHp) worst = a;
      }
      if (!worst) return null;
      const amount = (ability.heal || 0) + (actor.healBonus || 0) + (actor.level || 1) * 2;
      const healed = healActor(worst, amount, world);
      world.burst(worst.x, worst.y, 22, '#ffe9a8');
      return { targets: [worst], healed, text: `${ability.text} ${worst.name}` };
    }
    case 'enemy_kind': {
      const target = foes.find((f) => ability.kinds.includes(f.kind));
      if (!target || dist(actor.x, actor.y, target.x, target.y) > actor.attackRange + 12) return null;
      applyDamage(actor, target, actor.damage * ability.damageMult, world);
      world.burst(target.x, target.y, 26, '#fff3cf');
      return { targets: [target], text: `${ability.text} ${target.name}` };
    }
    case 'enemy_busy': {
      // Backstab: hit something that is already busy with somebody else.
      const target = foes.find(
        (f) => f.targetId && f.targetId !== actor.id && dist(actor.x, actor.y, f.x, f.y) <= actor.attackRange + 10,
      );
      if (!target) return null;
      applyDamage(actor, target, actor.damage * ability.damageMult, world, { noCrit: false });
      world.burst(target.x, target.y, 18, '#c9c0ff');
      return { targets: [target], text: `${ability.text} ${target.name}` };
    }
    case 'enemy_tough': {
      const target = foes
        .filter((f) => dist(actor.x, actor.y, f.x, f.y) <= (actor.ranged ? actor.attackRange : actor.attackRange + 14))
        .sort((a, b) => b.maxHp - a.maxHp)[0];
      if (!target || target.maxHp < 60) return null;
      applyStatus(target, ability.status, ability.duration, ability.power, actor);
      world.burst(target.x, target.y, 16, '#ff5f7a');
      return { targets: [target], text: `${ability.text} ${target.name}` };
    }
    default:
      return null;
  }
}

/** The densest knot of enemies, for abilities that land somewhere else. */
function pickCluster(foes, radius) {
  let best = null;
  let bestCount = 0;
  for (const f of foes) {
    let count = 0;
    for (const g of foes) if (dist(f.x, f.y, g.x, g.y) <= radius) count++;
    if (count > bestCount) {
      bestCount = count;
      best = f;
    }
  }
  return best;
}

/** Monster abilities: bosses only, and they announce themselves. */
export function tryMonsterAbilities(enemy, world, dt) {
  if (!enemy.abilities || !enemy.abilities.length) return null;
  const targets = world.hostilesNear(enemy, 200);
  for (const ability of enemy.abilities) {
    ability.timer -= dt;
    if (ability.timer > 0) continue;
    if (!targets.length) continue;
    ability.timer = ability.cooldown;

    if (ability.summon) {
      world.summon(enemy, ability.summon, ability.count || 1);
      return { ability, text: ability.text };
    }
    const radius = ability.radius || ability.cone || ability.range || 40;
    const hit = targets.filter((t) => dist(t.x, t.y, enemy.x, enemy.y) <= radius);
    if (!hit.length) {
      ability.timer = Math.min(ability.timer, 1.5);
      continue;
    }
    for (const t of hit) {
      applyDamage(enemy, t, ability.damage, world, { element: ability.id === 'breath' ? 'fire' : null });
      if (ability.status) applyStatus(t, ability.status, ability.duration || 4, ability.power || 3, enemy);
      if (ability.knockback) {
        const dx = t.x - enemy.x;
        const dy = t.y - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        t.x += (dx / len) * ability.knockback;
        t.y += (dy / len) * ability.knockback;
      }
    }
    world.burst(enemy.x, enemy.y, radius, enemy.accent || '#ffb347');
    return { ability, targets: hit, text: ability.text };
  }
  return null;
}
