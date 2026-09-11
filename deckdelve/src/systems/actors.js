// Making people and monsters. Guild adventurers persist between runs and carry
// their scars with them; monsters are built fresh from a template, scaled by how
// much attention the dungeon is currently paying to you.

import { getClass, CLASS_LIST } from '../data/classes.js';
import { ROLLABLE_TRAITS, traitSum, hasTrait } from '../data/traits.js';
import { gearSum, GEAR_BY_ID } from '../data/equipment.js';
import { getEnemy, ELITE } from '../data/enemies.js';
import { FIRST_NAMES, EPITHETS, HIRE_LINES } from '../data/names.js';
import { uid } from '../core/util.js';

export function xpForLevel(level) {
  return Math.round(45 + 42 * Math.pow(level - 1, 1.4));
}

/** Recomputes every derived number from class + level + gear + traits. */
export function refreshStats(adv) {
  const base = getClass(adv.classId);
  const lv = adv.level - 1;

  const hpBase = base.hp * (1 + 0.13 * lv) * (1 + traitSum(adv.traits, 'hpBonus'));
  adv.maxHp = Math.round(hpBase + gearSum(adv.equipment, 'hp'));
  adv.armor = Math.round(base.armor + lv * 0.5 + gearSum(adv.equipment, 'armor') + traitSum(adv.traits, 'armorBonus'));
  adv.damage = +(
    (base.damage * (1 + 0.1 * lv) + gearSum(adv.equipment, 'damage')) *
    (1 + traitSum(adv.traits, 'damageBonus'))
  ).toFixed(2);
  adv.attackTime = Math.max(0.28, base.attackTime - gearSum(adv.equipment, 'attackTime'));
  adv.attackRange = base.attackRange;
  adv.speed = Math.round(
    (base.speed + gearSum(adv.equipment, 'speed')) * (1 + traitSum(adv.traits, 'speedBonus')),
  );
  adv.crit = 0.05 + lv * 0.004 + gearSum(adv.equipment, 'crit') + traitSum(adv.traits, 'critBonus');
  adv.healBonus = gearSum(adv.equipment, 'healBonus');
  adv.statusResist = Math.min(0.8, gearSum(adv.equipment, 'statusResist') + traitSum(adv.traits, 'statusResist'));
  adv.fireResist = Math.min(0.8, gearSum(adv.equipment, 'fireResist'));
  adv.goldBonus = gearSum(adv.equipment, 'goldBonus') + traitSum(adv.traits, 'goldBonus');
  adv.ranged = !!base.ranged;
  adv.projectile = base.projectile || null;
  adv.healer = !!base.healer;
  adv.scout = !!base.scout;
  adv.color = base.color;
  adv.accent = base.accent;
  adv.role = base.role;
  adv.abilities = base.abilities.slice();

  // Nerve: the fraction of health at which this person decides to leave.
  adv.fleeThreshold = Math.min(
    0.7,
    Math.max(0.05, 0.28 + traitSum(adv.traits, 'fleeThreshold') + gearSum(adv.equipment, 'fleeThreshold')),
  );
  if (adv.hp === undefined || adv.hp === null) adv.hp = adv.maxHp;
  adv.hp = Math.min(adv.hp, adv.maxHp);
  return adv;
}

export function rollName(rng, taken = new Set()) {
  for (let i = 0; i < 40; i++) {
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(EPITHETS)}`;
    if (!taken.has(name)) return name;
  }
  return `${rng.pick(FIRST_NAMES)} ${rng.int(2, 99)}`;
}

/** A brand-new recruit, ready to be disappointed by a dungeon. */
export function createAdventurer(rng, opts = {}) {
  const classId = opts.classId || rng.pick(CLASS_LIST.filter((c) => !c.locked)).id;
  const traitCount = opts.traitCount !== undefined ? opts.traitCount : (rng.chance(0.35) ? 2 : 1);
  const traits = opts.traits || rng.sample(ROLLABLE_TRAITS, traitCount).map((t) => t.id);
  const adv = {
    id: uid('adv'),
    name: opts.name || rollName(rng, opts.taken),
    classId,
    level: opts.level || 1,
    xp: 0,
    traits,
    equipment: opts.equipment || { weapon: null, armor: null, trinket: null },
    hp: null,
    expeditions: 0,
    kills: 0,
    goldEarned: 0,
    hire: rng.pick(HIRE_LINES),
    alive: true,
  };
  refreshStats(adv);
  adv.hp = adv.maxHp;
  return adv;
}

/** Awards xp, levelling as many times as the total allows. */
export function grantXp(adv, amount) {
  const gained = Math.max(0, Math.round(amount * (1 + traitSum(adv.traits, 'xpBonus'))));
  adv.xp += gained;
  const levels = [];
  while (adv.xp >= xpForLevel(adv.level + 1)) {
    adv.xp -= xpForLevel(adv.level + 1);
    adv.level += 1;
    levels.push(adv.level);
  }
  if (levels.length) {
    const before = adv.maxHp;
    refreshStats(adv);
    adv.hp = Math.min(adv.maxHp, adv.hp + (adv.maxHp - before));
  }
  return { gained, levels };
}

/** The in-dungeon body: a guild member, given a position and a state machine. */
export function deployAdventurer(adv, x, y) {
  refreshStats(adv);
  return Object.assign(adv, {
    side: 'party',
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    roomKey: '0,0',
    cell: { x: 0, y: 0 },
    order: 'explore',
    orderPoint: null,
    focusId: null,
    state: 'idle',
    stateTime: 0,
    path: [],
    goal: null,
    goalKind: null,
    targetId: null,
    statuses: [],
    cooldowns: {},
    attackTimer: rng01(adv.id) * 0.4,
    interactTimer: 0,
    alive: true,
    downed: false,
    carriedGold: 0,
    carriedLoot: [],
    runKills: 0,
    barkTimer: 2 + rng01(adv.name) * 4,
    hitFlash: 0,
    swing: 0,
    selected: false,
    lastRoomKey: null,
    deathRoom: null,
    restTimer: 0,
  });
}

/** Cheap deterministic jitter from a string, so bodies do not act in lockstep. */
function rng01(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

let enemySerial = 0;

/** Builds a live monster from a template. */
export function createEnemy(typeId, x, y, roomKey, opts = {}) {
  const def = getEnemy(typeId);
  enemySerial += 1;
  const threat = opts.threat || 0;
  const depth = opts.depth || 0;
  const biome = opts.biomeBonus || null;

  const threatHp = 1 + threat * 0.011 + depth * 0.05;
  const threatDmg = 1 + threat * 0.007 + depth * 0.03;
  const eliteMult = opts.elite && !def.boss ? ELITE : null;

  const maxHp = Math.round(
    def.hp * threatHp * (eliteMult ? eliteMult.hpMult : 1) * (biome ? biome.hp || 1 : 1),
  );
  const enemy = {
    id: `foe_${enemySerial}`,
    side: 'foe',
    type: typeId,
    def,
    name: eliteMult ? `${opts.prefix || 'Elite'} ${def.name}` : def.name,
    kind: def.kind,
    body: def.body,
    color: def.color,
    accent: def.accent,
    elite: !!eliteMult,
    boss: !!def.boss,
    maxHp,
    hp: maxHp,
    armor: def.armor + (eliteMult ? eliteMult.armorBonus : 0),
    damage: +(def.damage * threatDmg * (eliteMult ? eliteMult.damageMult : 1) * (biome ? biome.damage || 1 : 1)).toFixed(2),
    attackRange: def.attackRange,
    attackTime: def.attackTime,
    speed: def.speed,
    ranged: !!def.ranged,
    projectile: def.projectile || null,
    aggro: def.aggro,
    xp: Math.round(def.xp * (eliteMult ? eliteMult.xpMult : 1) * (1 + depth * 0.08)),
    gold: def.gold,
    goldMult: (eliteMult ? eliteMult.goldMult : 1) * (1 + depth * 0.1),
    scale: (def.scale || 1) * (eliteMult ? eliteMult.scale : 1),
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    roomKey,
    homeX: x,
    homeY: y,
    statuses: [],
    cooldowns: {},
    attackTimer: 0,
    targetId: null,
    state: 'idle',
    alive: true,
    hitFlash: 0,
    swing: 0,
    abilities: (def.abilities || []).map((a) => ({ ...a, timer: a.cooldown * 0.6 })),
    onHit: def.onHit || null,
    onDeath: def.onDeath || null,
  };
  return enemy;
}

export { hasTrait, traitSum, GEAR_BY_ID };
