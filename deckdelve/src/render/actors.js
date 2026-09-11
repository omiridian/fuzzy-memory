// Drawing the people and the things eating them. Everything is drawn from
// shapes — no sprite sheets — so a new monster is a new function, not a new
// asset pipeline.

import { STATUS } from '../data/status.js';
import { FONT_UI, icon, text } from './ui.js';

function shadow(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.75, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hpBar(ctx, actor, x, y, w) {
  const frac = Math.max(0, actor.hp / actor.maxHp);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
  ctx.fillStyle = frac > 0.55 ? '#7dc96f' : frac > 0.28 ? '#e0b64a' : '#d2503f';
  ctx.fillRect(x - w / 2, y, w * frac, 2);
  ctx.restore();
}

function statusPips(ctx, actor, x, y) {
  if (!actor.statuses.length) return;
  const seen = new Set();
  let i = 0;
  for (const s of actor.statuses) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const def = STATUS[s.id];
    if (!def) continue;
    icon(ctx, def.icon, x - 6 + i * 8, y, 6, def.color);
    i++;
  }
}

// ---------------------------------------------------------------------------
// Adventurers
// ---------------------------------------------------------------------------

const CLASS_GLYPH = {
  fighter: (ctx, s, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(s * 0.5, -s * 0.9, s * 0.22, s * 1.5); // blade
    ctx.fillRect(s * 0.32, -s * 0.15, s * 0.6, s * 0.16); // crossguard
  },
  rogue: (ctx, s, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(s * 0.45, -s * 0.4, s * 0.16, s * 0.8);
  },
  mage: (ctx, s, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.8);
    ctx.lineTo(s * 0.5, -s * 1.1);
    ctx.stroke();
    ctx.fillStyle = '#a9d8ff';
    ctx.beginPath();
    ctx.arc(s * 0.5, -s * 1.2, s * 0.26, 0, Math.PI * 2);
    ctx.fill();
  },
  cleric: (ctx, s, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(s * 0.42, -s * 1.1, s * 0.16, s * 1.7);
    ctx.fillRect(s * 0.2, -s * 0.75, s * 0.6, s * 0.16);
  },
  ranger: (ctx, s, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.arc(s * 0.45, 0, s * 0.75, -Math.PI / 2.2, Math.PI / 2.2);
    ctx.stroke();
  },
};

export function drawAdventurer(ctx, adv, time) {
  if (!adv.alive) return;
  const s = 7;
  shadow(ctx, adv.x, adv.y, s);

  ctx.save();
  ctx.translate(adv.x, adv.y);

  if (adv.selected) {
    ctx.save();
    ctx.strokeStyle = 'rgba(240, 225, 160, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.7, s * 1.5, s * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const bob = Math.sin(time * 7 + adv.x * 0.1) * (adv.state === 'moving' ? 1.1 : 0.35);
  ctx.scale(adv.facing, 1);
  ctx.translate(0, bob);

  // swing animation
  if (adv.swing > 0) ctx.rotate(adv.swing * 1.4 * (adv.facing > 0 ? 1 : -1));

  const glyph = CLASS_GLYPH[adv.classId];
  if (glyph) {
    ctx.save();
    glyph(ctx, s, adv.accent || '#ddd');
    ctx.restore();
  }

  // cloak / body
  ctx.fillStyle = adv.hitFlash > 0 ? '#ffffff' : adv.color;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.2);
  ctx.quadraticCurveTo(s * 0.95, s * 0.3, 0, s * 1.05);
  ctx.quadraticCurveTo(-s * 0.95, s * 0.3, 0, -s * 0.2);
  ctx.fill();

  // head
  ctx.fillStyle = adv.hitFlash > 0 ? '#ffffff' : '#e8c9a0';
  ctx.beginPath();
  ctx.arc(0, -s * 0.65, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = adv.accent || '#fff';
  ctx.beginPath();
  ctx.arc(0, -s * 0.85, s * 0.5, Math.PI, 0);
  ctx.fill();
  ctx.restore();

  hpBar(ctx, adv, adv.x, adv.y - s * 2.2, 22);
  statusPips(ctx, adv, adv.x, adv.y - s * 3.1);

  if (adv.state === 'interacting') {
    ctx.save();
    ctx.strokeStyle = 'rgba(240, 220, 150, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(adv.x, adv.y - 20, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, adv.interactTimer / 2.4));
    ctx.stroke();
    ctx.restore();
  }
  if (adv.fleeing) {
    text(ctx, '!', adv.x + 9, adv.y - 16, { size: 12, color: '#ff9a6a', weight: 'bold' });
  }
}

/**
 * Names are drawn at a fixed size on screen rather than in the world, so zoom
 * does not change how big they are. Only the selection gets one: four bodies in
 * one doorway with four names over them is a smear, and the party panel already
 * says who is who.
 */
export function drawNameplate(ctx, adv, zoom = 1) {
  if (!adv.alive) return;
  ctx.save();
  ctx.translate(adv.x, adv.y + 18);
  ctx.scale(1 / zoom, 1 / zoom);
  text(ctx, adv.name.split(' ')[0], 0, 0, {
    align: 'center',
    size: 10,
    color: 'rgba(240,235,220,0.78)',
    font: FONT_UI,
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

const BODIES = {
  goblin: (ctx, s, c, a) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.75, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.5);
    ctx.lineTo(-s * 1.25, -s * 0.95);
    ctx.lineTo(-s * 0.45, -s * 0.75);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.7, -s * 0.5);
    ctx.lineTo(s * 1.25, -s * 0.95);
    ctx.lineTo(s * 0.45, -s * 0.75);
    ctx.fill();
    ctx.fillStyle = a;
    ctx.fillRect(s * 0.55, -s * 0.2, s * 0.9, s * 0.16);
  },
  spider: (ctx, s, c, a) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = s * 0.16;
    for (let i = 0; i < 4; i++) {
      const ang = -0.7 + i * 0.45;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(dir * s * 1.1, Math.sin(ang) * s * 0.9, dir * s * 1.5, Math.sin(ang) * s * 1.4);
        ctx.stroke();
      }
    }
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.1, s * 0.62, s * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.4, s * 0.13, 0, Math.PI * 2);
    ctx.arc(s * 0.2, -s * 0.4, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  },
  skeleton: (ctx, s, c, a) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, -s * 0.55, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-s * 0.34, -s * 0.1, s * 0.68, s * 0.95);
    ctx.fillStyle = a;
    for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.34, s * 0.1 + i * s * 0.26, s * 0.68, s * 0.1);
    ctx.fillStyle = '#2a2620';
    ctx.beginPath();
    ctx.arc(-s * 0.17, -s * 0.6, s * 0.12, 0, Math.PI * 2);
    ctx.arc(s * 0.17, -s * 0.6, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9b3a4';
    ctx.fillRect(s * 0.45, -s * 0.85, s * 0.14, s * 1.5);
  },
  ghoul: (ctx, s, c, a) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.15, s * 0.8, s * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s * 0.72, s * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.arc(-s * 0.16, -s * 0.78, s * 0.1, 0, Math.PI * 2);
    ctx.arc(s * 0.16, -s * 0.78, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = a;
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, s * 0.1);
    ctx.lineTo(-s * 1.25, s * 0.75);
    ctx.moveTo(s * 0.75, s * 0.1);
    ctx.lineTo(s * 1.25, s * 0.75);
    ctx.stroke();
  },
  imp: (ctx, s, c, a) => {
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.3);
    ctx.lineTo(-s * 1.5, -s * 1.1);
    ctx.lineTo(-s * 0.4, s * 0.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.3);
    ctx.lineTo(s * 1.5, -s * 1.1);
    ctx.lineTo(s * 0.4, s * 0.3);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.6, s * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff0c0';
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.2, s * 0.12, 0, Math.PI * 2);
    ctx.arc(s * 0.2, -s * 0.2, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  },
  myconid: (ctx, s, c, a) => {
    ctx.fillStyle = a;
    ctx.fillRect(-s * 0.22, -s * 0.1, s * 0.44, s * 1.0);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.15, s * 0.95, s * 0.62, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-s * 0.45 + i * s * 0.45, -s * 0.42, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  lurker: (ctx, s, c, a) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.05, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = s * 0.2;
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI + 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(ang) * s * 1.2, s * 0.9, Math.cos(ang) * s * 1.7, s * 1.25);
      ctx.stroke();
    }
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.arc(-s * 0.3, -s * 0.25, s * 0.16, 0, Math.PI * 2);
    ctx.arc(s * 0.3, -s * 0.25, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  },
  bandit: (ctx, s, c, a) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.9, s * 0.3, 0, s * 1.0);
    ctx.quadraticCurveTo(-s * 0.9, s * 0.3, 0, -s * 0.3);
    ctx.fill();
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath();
    ctx.arc(0, -s * 0.7, s * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2530';
    ctx.fillRect(-s * 0.5, -s * 0.82, s * 1.0, s * 0.22);
    ctx.fillStyle = a;
    ctx.fillRect(s * 0.5, -s * 0.5, s * 0.13, s * 1.1);
  },
  mimic: (ctx, s, c, a) => {
    ctx.fillStyle = c;
    ctx.fillRect(-s, -s * 0.4, s * 2, s * 1.2);
    ctx.fillStyle = a;
    ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.22);
    ctx.fillStyle = '#3a1f20';
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, -s * 0.4);
    ctx.lineTo(s * 0.9, -s * 0.4);
    ctx.lineTo(s * 0.8, -s * 1.1);
    ctx.lineTo(-s * 0.8, -s * 1.1);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.8 + i * s * 0.27, -s * 0.42);
      ctx.lineTo(-s * 0.66 + i * s * 0.27, -s * 0.78);
      ctx.lineTo(-s * 0.52 + i * s * 0.27, -s * 0.42);
      ctx.fill();
    }
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 1.15);
    ctx.lineTo(-s * 0.3, -s * 1.55);
    ctx.lineTo(-s * 0.1, -s * 1.15);
    ctx.lineTo(s * 0.1, -s * 1.55);
    ctx.lineTo(s * 0.3, -s * 1.15);
    ctx.fill();
  },
  wyrm: (ctx, s, c, a) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.1, s * 1.15, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.3);
    ctx.quadraticCurveTo(-s * 2.2, -s * 1.5, -s * 2.4, s * 0.2);
    ctx.quadraticCurveTo(-s * 1.5, -s * 0.3, -s * 0.5, s * 0.4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 0.3);
    ctx.quadraticCurveTo(s * 2.2, -s * 1.5, s * 2.4, s * 0.2);
    ctx.quadraticCurveTo(s * 1.5, -s * 0.3, s * 0.5, s * 0.4);
    ctx.fill();
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.5);
    ctx.lineTo(s * 0.55, -s * 0.5);
    ctx.lineTo(-s * 0.55, -s * 0.5);
    ctx.fill();
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath();
    ctx.arc(-s * 0.22, -s * 1.05, s * 0.13, 0, Math.PI * 2);
    ctx.arc(s * 0.22, -s * 1.05, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  },
};

export function drawEnemy(ctx, enemy, time, zoom = 1) {
  const s = 7 * (enemy.scale || 1);
  if (!enemy.alive) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, enemy.hitFlash * 3);
    ctx.translate(enemy.x, enemy.y);
    ctx.scale(1, 0.4);
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  shadow(ctx, enemy.x, enemy.y, s);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const bob = Math.sin(time * 5 + enemy.x * 0.13) * (enemy.state === 'hunting' ? 1.2 : 0.4);
  ctx.translate(0, bob);
  ctx.scale(enemy.facing, 1);
  if (enemy.swing > 0) ctx.rotate(enemy.swing * -1.1);

  if (enemy.elite || enemy.boss) {
    ctx.save();
    ctx.strokeStyle = enemy.boss ? 'rgba(255, 120, 80, 0.8)' : 'rgba(255, 200, 90, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.65 + Math.sin(time * 3) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const body = BODIES[enemy.body] || BODIES.goblin;
  const flash = enemy.hitFlash > 0;
  body(ctx, s, flash ? '#ffffff' : enemy.color, flash ? '#ffffff' : enemy.accent);
  ctx.restore();

  hpBar(ctx, enemy, enemy.x, enemy.y - s * 2 - 4, enemy.boss ? 44 : enemy.elite ? 28 : 20);
  statusPips(ctx, enemy, enemy.x, enemy.y - s * 2 - 11);
  if (enemy.boss) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y - s * 2 - 16);
    ctx.scale(1 / zoom, 1 / zoom);
    text(ctx, enemy.name, 0, 0, { align: 'center', size: 11, color: '#ffb9a0', weight: 'bold' });
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export function drawProjectiles(ctx, projectiles) {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    if (p.kind === 'arrow') {
      ctx.strokeStyle = '#d8c9a0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();
    } else if (p.kind === 'ember') {
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 210, 120, 0.5)';
      ctx.beginPath();
      ctx.arc(-4, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#a9d8ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 210, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(-5, 0, 4, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / (p.max || 0.6));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawFloaters(ctx, floaters) {
  for (const f of floaters) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    text(ctx, f.text, f.x, f.y, {
      align: 'center',
      size: 11,
      color: f.color,
      weight: 'bold',
      font: FONT_UI,
    });
    ctx.restore();
  }
}

