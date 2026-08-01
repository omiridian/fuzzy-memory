// Procedural sprite painter. Every creature is drawn from its body plan and
// palette, so the game ships with hundreds of distinct-looking species and no
// image assets at all.

import { rngFromString } from '../core/rng.js';
import { getSpecies } from '../data/species.js';

const cache = new Map();

function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (num & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function ellipse(ctx, x, y, rx, ry, fill, stroke = null) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function poly(ctx, points, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function eyes(ctx, cx, cy, spread, size, palette, mood = 0) {
  for (const dir of [-1, 1]) {
    const x = cx + dir * spread;
    ellipse(ctx, x, cy, size, size * 1.15, palette.eye);
    ellipse(ctx, x + dir * size * 0.15, cy + size * 0.15 - mood, size * 0.5, size * 0.62, palette.pupil);
  }
}

/**
 * Draws a creature centred in a box.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} speciesId
 * @param {number} cx centre x
 * @param {number} cy baseline y (feet)
 * @param {number} size overall height in pixels
 * @param {object} opts { back, shiny, flip, alpha }
 */
export function drawCreature(ctx, speciesId, cx, cy, size, opts = {}) {
  const species = getSpecies(speciesId);
  if (!species) return;
  const rng = rngFromString('sprite:' + speciesId);
  const p = { ...species.palette };
  if (opts.shiny) {
    p.body = shade(p.body, 46);
    p.accent = '#f4e07a';
  }
  const s = size;
  const back = !!opts.back;

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.translate(cx, cy);
  if (opts.flip) ctx.scale(-1, 1);

  const outline = shade(p.shade, -30);
  const detailRolls = {
    spots: rng.percent(35),
    stripes: rng.percent(30),
    horns: rng.percent(38),
    crest: rng.percent(30),
    tailTuft: rng.percent(45),
    extraLimbs: rng.percent(25),
  };

  // Ground shadow.
  ellipse(ctx, 0, 0, s * 0.42, s * 0.09, 'rgba(0,0,0,0.22)');

  switch (species.plan) {
    case 'quadruped':
      drawQuadruped(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'biped':
      drawBiped(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'avian':
      drawAvian(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'aquatic':
      drawAquatic(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'serpent':
      drawSerpent(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'insectoid':
      drawInsectoid(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'arachnid':
      drawArachnid(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'plant':
      drawPlant(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'floater':
      drawFloater(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'construct':
      drawConstruct(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'draconic':
      drawDraconic(ctx, s, p, outline, detailRolls, back, rng);
      break;
    case 'amorphous':
    default:
      drawAmorphous(ctx, s, p, outline, detailRolls, back, rng);
      break;
  }

  ctx.restore();
}

// ── Body plans ─────────────────────────────────────────────────────────────
function legs(ctx, s, p, outline, count = 4, spread = 0.26) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const x = t * s * spread * 2;
    ctx.fillStyle = p.shade;
    ctx.fillRect(x - s * 0.05, -s * 0.22, s * 0.1, s * 0.22);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - s * 0.05, -s * 0.22, s * 0.1, s * 0.22);
  }
}

function tail(ctx, s, p, outline, tuft) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(s * 0.3, -s * 0.42);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.55, s * 0.48, -s * 0.75);
  ctx.lineWidth = s * 0.07;
  ctx.strokeStyle = p.shade;
  ctx.lineCap = 'round';
  ctx.stroke();
  if (tuft) ellipse(ctx, s * 0.48, -s * 0.78, s * 0.09, s * 0.09, p.accent, outline);
  ctx.restore();
}

function horns(ctx, s, p, outline, x, y) {
  for (const dir of [-1, 1]) {
    poly(
      ctx,
      [
        [x + dir * s * 0.12, y],
        [x + dir * s * 0.2, y - s * 0.18],
        [x + dir * s * 0.06, y - s * 0.05],
      ],
      p.accent,
      outline
    );
  }
}

function spots(ctx, s, p, rng, cx, cy, rx, ry, n = 4) {
  for (let i = 0; i < n; i++) {
    const a = rng.float(0, Math.PI * 2);
    const r = rng.float(0.2, 0.7);
    ellipse(ctx, cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, s * 0.05, s * 0.04, p.accent);
  }
}

function drawQuadruped(ctx, s, p, outline, d, back, rng) {
  legs(ctx, s, p, outline, 4, 0.3);
  ellipse(ctx, 0, -s * 0.42, s * 0.34, s * 0.24, p.body, outline);
  if (d.spots) spots(ctx, s, p, rng, 0, -s * 0.42, s * 0.3, s * 0.2, 5);
  tail(ctx, s, p, outline, d.tailTuft);
  const hx = -s * 0.3;
  const hy = -s * 0.58;
  ellipse(ctx, hx, hy, s * 0.19, s * 0.17, p.body, outline);
  // ears
  for (const dir of [-1, 1]) {
    poly(
      ctx,
      [
        [hx + dir * s * 0.08, hy - s * 0.12],
        [hx + dir * s * 0.16, hy - s * 0.28],
        [hx + dir * s * 0.02, hy - s * 0.16],
      ],
      p.body,
      outline
    );
  }
  if (d.horns) horns(ctx, s, p, outline, hx, hy - s * 0.14);
  if (!back) {
    eyes(ctx, hx - s * 0.02, hy - s * 0.02, s * 0.07, s * 0.045, p);
    ellipse(ctx, hx - s * 0.14, hy + s * 0.05, s * 0.04, s * 0.03, p.shade);
  }
}

function drawBiped(ctx, s, p, outline, d, back, rng) {
  legs(ctx, s, p, outline, 2, 0.14);
  ellipse(ctx, 0, -s * 0.44, s * 0.24, s * 0.26, p.body, outline);
  if (d.stripes) {
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.2, -s * 0.55 + i * s * 0.1, s * 0.4, s * 0.03);
  }
  // arms
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = p.shade;
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dir * s * 0.2, -s * 0.52);
    ctx.lineTo(dir * s * 0.32, -s * 0.3);
    ctx.stroke();
  }
  const hy = -s * 0.78;
  ellipse(ctx, 0, hy, s * 0.2, s * 0.19, p.body, outline);
  if (d.crest) poly(ctx, [[0, hy - s * 0.18], [-s * 0.1, hy - s * 0.05], [s * 0.1, hy - s * 0.05]], p.accent, outline);
  if (d.horns) horns(ctx, s, p, outline, 0, hy - s * 0.1);
  if (!back) eyes(ctx, 0, hy - s * 0.02, s * 0.08, s * 0.05, p);
}

function drawAvian(ctx, s, p, outline, d, back, rng) {
  legs(ctx, s, p, outline, 2, 0.1);
  // wings behind the body
  for (const dir of [-1, 1]) {
    poly(
      ctx,
      [
        [dir * s * 0.1, -s * 0.5],
        [dir * s * 0.52, -s * 0.72],
        [dir * s * 0.44, -s * 0.36],
      ],
      p.accent,
      outline
    );
  }
  ellipse(ctx, 0, -s * 0.48, s * 0.22, s * 0.26, p.body, outline);
  const hy = -s * 0.78;
  ellipse(ctx, 0, hy, s * 0.16, s * 0.15, p.body, outline);
  poly(ctx, [[-s * 0.14, hy], [-s * 0.3, hy + s * 0.03], [-s * 0.14, hy + s * 0.07]], p.accent, outline);
  if (d.crest) {
    poly(ctx, [[0, hy - s * 0.15], [-s * 0.06, hy - s * 0.04], [s * 0.08, hy - s * 0.06]], p.accent, outline);
  }
  if (!back) eyes(ctx, -s * 0.02, hy - s * 0.02, s * 0.06, s * 0.042, p);
}

function drawAquatic(ctx, s, p, outline, d, back, rng) {
  ellipse(ctx, 0, -s * 0.4, s * 0.36, s * 0.24, p.body, outline);
  // tail fin
  poly(
    ctx,
    [
      [s * 0.3, -s * 0.4],
      [s * 0.56, -s * 0.6],
      [s * 0.52, -s * 0.2],
    ],
    p.accent,
    outline
  );
  // dorsal
  poly(ctx, [[0, -s * 0.62], [-s * 0.12, -s * 0.42], [s * 0.14, -s * 0.44]], p.accent, outline);
  // side fin
  poly(ctx, [[-s * 0.06, -s * 0.34], [-s * 0.02, -s * 0.14], [s * 0.14, -s * 0.32]], p.shade, outline);
  if (d.spots) spots(ctx, s, p, rng, 0, -s * 0.4, s * 0.3, s * 0.18, 4);
  if (!back) eyes(ctx, -s * 0.2, -s * 0.45, s * 0.06, s * 0.045, p);
}

function drawSerpent(ctx, s, p, outline, d, back, rng) {
  ctx.strokeStyle = p.body;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.34, -s * 0.08);
  ctx.quadraticCurveTo(-s * 0.34, -s * 0.2, s * 0.16, -s * 0.42);
  ctx.quadraticCurveTo(-s * 0.24, -s * 0.6, -s * 0.06, -s * 0.72);
  ctx.stroke();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const hy = -s * 0.78;
  ellipse(ctx, -s * 0.08, hy, s * 0.17, s * 0.14, p.body, outline);
  if (d.horns) horns(ctx, s, p, outline, -s * 0.08, hy - s * 0.1);
  if (d.stripes) {
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 3; i++) ellipse(ctx, s * 0.2 - i * s * 0.12, -s * 0.2 - i * s * 0.1, s * 0.05, s * 0.04, p.accent);
  }
  if (!back) eyes(ctx, -s * 0.1, hy - s * 0.02, s * 0.07, s * 0.04, p);
}

function drawInsectoid(ctx, s, p, outline, d, back, rng) {
  legs(ctx, s, p, outline, 6, 0.3);
  // wings
  for (const dir of [-1, 1]) {
    ctx.globalAlpha = 0.7;
    ellipse(ctx, dir * s * 0.3, -s * 0.6, s * 0.22, s * 0.13, p.accent, outline);
    ctx.globalAlpha = 1;
  }
  ellipse(ctx, s * 0.06, -s * 0.4, s * 0.24, s * 0.19, p.body, outline);
  ellipse(ctx, -s * 0.18, -s * 0.5, s * 0.15, s * 0.14, p.body, outline);
  const hy = -s * 0.62;
  ellipse(ctx, -s * 0.3, hy, s * 0.13, s * 0.12, p.body, outline);
  // antennae
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = p.shade;
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, hy - s * 0.08);
    ctx.lineTo(-s * 0.42, hy - s * 0.22 + dir * s * 0.06);
    ctx.stroke();
  }
  if (!back) eyes(ctx, -s * 0.32, hy - s * 0.01, s * 0.06, s * 0.045, p);
}

function drawArachnid(ctx, s, p, outline, d, back, rng) {
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = p.shade;
      ctx.lineWidth = s * 0.045;
      ctx.beginPath();
      ctx.moveTo(dir * s * 0.16, -s * 0.34);
      ctx.quadraticCurveTo(dir * s * (0.42 + i * 0.06), -s * (0.5 - i * 0.1), dir * s * (0.34 + i * 0.08), 0);
      ctx.stroke();
    }
  }
  ellipse(ctx, 0, -s * 0.4, s * 0.3, s * 0.24, p.body, outline);
  ellipse(ctx, -s * 0.24, -s * 0.44, s * 0.14, s * 0.13, p.shade, outline);
  // claws
  for (const dir of [-1, 1]) {
    poly(
      ctx,
      [
        [dir * s * 0.34, -s * 0.5],
        [dir * s * 0.52, -s * 0.62],
        [dir * s * 0.46, -s * 0.42],
      ],
      p.accent,
      outline
    );
  }
  if (!back) eyes(ctx, -s * 0.26, -s * 0.46, s * 0.05, s * 0.035, p);
}

function drawPlant(ctx, s, p, outline, d, back, rng) {
  // roots / pot
  poly(
    ctx,
    [
      [-s * 0.24, 0],
      [s * 0.24, 0],
      [s * 0.16, -s * 0.2],
      [-s * 0.16, -s * 0.2],
    ],
    p.shade,
    outline
  );
  ellipse(ctx, 0, -s * 0.42, s * 0.24, s * 0.24, p.body, outline);
  // leaves
  const leafCount = 3 + (rng.percent(50) ? 2 : 0);
  for (let i = 0; i < leafCount; i++) {
    const a = -Math.PI / 2 + (i - (leafCount - 1) / 2) * 0.55;
    const lx = Math.cos(a) * s * 0.34;
    const ly = -s * 0.5 + Math.sin(a) * s * 0.3;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ellipse(ctx, 0, 0, s * 0.06, s * 0.16, p.accent, outline);
    ctx.restore();
  }
  if (d.crest) ellipse(ctx, 0, -s * 0.74, s * 0.09, s * 0.09, p.accent, outline);
  if (!back) eyes(ctx, 0, -s * 0.44, s * 0.08, s * 0.05, p);
}

function drawFloater(ctx, s, p, outline, d, back, rng) {
  ctx.globalAlpha = 0.92;
  ellipse(ctx, 0, -s * 0.55, s * 0.28, s * 0.3, p.body, outline);
  // trailing wisps
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * s * 0.16;
    ctx.beginPath();
    ctx.moveTo(x, -s * 0.3);
    ctx.quadraticCurveTo(x + s * 0.06, -s * 0.16, x, -s * 0.04);
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = p.shade;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  if (d.crest) {
    for (const dir of [-1, 1]) {
      poly(
        ctx,
        [
          [dir * s * 0.24, -s * 0.66],
          [dir * s * 0.42, -s * 0.82],
          [dir * s * 0.3, -s * 0.52],
        ],
        p.accent,
        outline
      );
    }
  }
  ctx.globalAlpha = 1;
  if (!back) eyes(ctx, 0, -s * 0.58, s * 0.09, s * 0.055, p);
}

function drawConstruct(ctx, s, p, outline, d, back, rng) {
  ctx.fillStyle = p.shade;
  ctx.fillRect(-s * 0.26, -s * 0.24, s * 0.52, s * 0.24);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(-s * 0.26, -s * 0.24, s * 0.52, s * 0.24);
  ctx.fillStyle = p.body;
  ctx.fillRect(-s * 0.3, -s * 0.66, s * 0.6, s * 0.42);
  ctx.strokeRect(-s * 0.3, -s * 0.66, s * 0.6, s * 0.42);
  if (d.spots) {
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.22 + i * s * 0.16, -s * 0.6, s * 0.08, s * 0.08);
  }
  ctx.fillStyle = p.body;
  ctx.fillRect(-s * 0.18, -s * 0.86, s * 0.36, s * 0.2);
  ctx.strokeRect(-s * 0.18, -s * 0.86, s * 0.36, s * 0.2);
  if (d.horns) horns(ctx, s, p, outline, 0, -s * 0.86);
  if (!back) eyes(ctx, 0, -s * 0.76, s * 0.08, s * 0.045, p);
}

function drawDraconic(ctx, s, p, outline, d, back, rng) {
  legs(ctx, s, p, outline, 4, 0.26);
  // wings
  for (const dir of [-1, 1]) {
    poly(
      ctx,
      [
        [dir * s * 0.08, -s * 0.56],
        [dir * s * 0.5, -s * 0.86],
        [dir * s * 0.46, -s * 0.5],
        [dir * s * 0.26, -s * 0.44],
      ],
      p.accent,
      outline
    );
  }
  ellipse(ctx, 0, -s * 0.46, s * 0.32, s * 0.24, p.body, outline);
  tail(ctx, s, p, outline, true);
  const hx = -s * 0.32;
  const hy = -s * 0.66;
  ellipse(ctx, hx, hy, s * 0.2, s * 0.16, p.body, outline);
  poly(ctx, [[hx - s * 0.16, hy + s * 0.02], [hx - s * 0.34, hy + s * 0.06], [hx - s * 0.16, hy + s * 0.1]], p.shade, outline);
  horns(ctx, s, p, outline, hx, hy - s * 0.12);
  if (!back) eyes(ctx, hx, hy - s * 0.03, s * 0.07, s * 0.045, p);
}

function drawAmorphous(ctx, s, p, outline, d, back, rng) {
  ctx.beginPath();
  const points = 9;
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble = 0.78 + rng.float(0, 0.3);
    const x = Math.cos(a) * s * 0.32 * wobble;
    const y = -s * 0.36 + Math.sin(a) * s * 0.3 * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = p.body;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (d.spots) spots(ctx, s, p, rng, 0, -s * 0.36, s * 0.24, s * 0.22, 4);
  if (!back) eyes(ctx, 0, -s * 0.42, s * 0.09, s * 0.055, p);
}

// ── Overworld people ───────────────────────────────────────────────────────
const PERSON_PALETTES = {
  player: { body: '#d94f4f', hair: '#3b2b22', skin: '#e8c39e' },
  child: { body: '#4fa3d9', hair: '#5b3a1e', skin: '#f0cba6' },
  woman: { body: '#c76bb0', hair: '#2f2a3a', skin: '#e6bd94' },
  man: { body: '#4f7ad9', hair: '#3a2a1c', skin: '#d8ac82' },
  elder: { body: '#8a8a94', hair: '#e0e0e6', skin: '#dcb894' },
  youth: { body: '#5fb35f', hair: '#c8913a', skin: '#eec9a4' },
  nurse: { body: '#f0f0f4', hair: '#d95f7a', skin: '#e8c39e' },
  clerk: { body: '#3f8f6f', hair: '#2a2a2a', skin: '#d8ac82' },
  aide: { body: '#e8e8ee', hair: '#4a3a2a', skin: '#e0b894' },
  professor: { body: '#f4f4f8', hair: '#b0b0bc', skin: '#e2bb96' },
  compact: { body: '#8a3a3a', hair: '#1a1a1e', skin: '#d0a078' },
  compact_officer: { body: '#5a2a4a', hair: '#14141a', skin: '#d8a880' },
  compact_leader: { body: '#3a1a3a', hair: '#e0d0e0', skin: '#c89878' },
  warden_verdant: { body: '#57b05a', hair: '#3a5a2a', skin: '#e0b894' },
  warden_tide: { body: '#3f8fd8', hair: '#2a3a5a', skin: '#dcb08c' },
  warden_volt: { body: '#e7c33c', hair: '#5a4a1a', skin: '#d8a878' },
  warden_ember: { body: '#ef6b3a', hair: '#5a2a1a', skin: '#d0a074' },
};

/** Draws a person-shaped overworld sprite. */
export function drawPerson(ctx, kind, x, y, size, dir = 'down', frame = 0) {
  if (kind === 'terminal') return drawTerminal(ctx, x, y, size);
  if (kind === 'case') return drawCase(ctx, x, y, size);
  if (kind === 'legendary') return drawShrineGlow(ctx, x, y, size);
  const p = PERSON_PALETTES[kind] || PERSON_PALETTES.man;
  const s = size;
  const bob = frame % 2 === 1 ? s * 0.03 : 0;

  ctx.save();
  ctx.translate(x, y - bob);
  ellipse(ctx, 0, s * 0.02, s * 0.3, s * 0.08, 'rgba(0,0,0,0.2)');

  // legs
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(-s * 0.18, -s * 0.28, s * 0.14, s * 0.28);
  ctx.fillRect(s * 0.04, -s * 0.28, s * 0.14, s * 0.28);
  // body
  ctx.fillStyle = p.body;
  ctx.fillRect(-s * 0.26, -s * 0.66, s * 0.52, s * 0.4);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-s * 0.26, -s * 0.66, s * 0.52, s * 0.4);
  // head
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(0, -s * 0.8, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // hair
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(0, -s * 0.84, s * 0.22, Math.PI, Math.PI * 2);
  ctx.fill();
  if (dir === 'down' || dir === 'left' || dir === 'right') {
    const offset = dir === 'left' ? -s * 0.06 : dir === 'right' ? s * 0.06 : 0;
    ctx.fillStyle = '#241f28';
    ctx.fillRect(offset - s * 0.1, -s * 0.82, s * 0.05, s * 0.05);
    ctx.fillRect(offset + s * 0.05, -s * 0.82, s * 0.05, s * 0.05);
  }
  ctx.restore();
}

function drawTerminal(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#2f3a4a';
  ctx.fillRect(-s * 0.3, -s * 0.8, s * 0.6, s * 0.8);
  ctx.fillStyle = '#7fd6e0';
  ctx.fillRect(-s * 0.22, -s * 0.72, s * 0.44, s * 0.3);
  ctx.fillStyle = '#1b2430';
  ctx.fillRect(-s * 0.22, -s * 0.36, s * 0.44, s * 0.24);
  ctx.restore();
}

function drawCase(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5);
  ctx.fillStyle = '#c8a878';
  ctx.fillRect(-s * 0.36, -s * 0.46, s * 0.72, s * 0.2);
  for (let i = 0; i < 3; i++) {
    ellipse(ctx, -s * 0.24 + i * s * 0.24, -s * 0.36, s * 0.08, s * 0.08, ['#ef6b3a', '#3f8fd8', '#57b05a'][i], '#2a2a2a');
  }
  ctx.restore();
}

function drawShrineGlow(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  const grd = ctx.createRadialGradient(0, -s * 0.5, s * 0.05, 0, -s * 0.5, s * 0.7);
  grd.addColorStop(0, 'rgba(240,230,160,0.95)');
  grd.addColorStop(1, 'rgba(240,230,160,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, -s * 0.5, s * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Renders a creature to an offscreen canvas once and reuses it. */
export function creatureImage(speciesId, size, opts = {}) {
  const key = `${speciesId}:${size}:${opts.back ? 'b' : 'f'}:${opts.shiny ? 's' : ''}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size * 1.4;
  canvas.height = size * 1.2;
  const ctx = canvas.getContext('2d');
  drawCreature(ctx, speciesId, canvas.width / 2, canvas.height - size * 0.12, size, opts);
  cache.set(key, canvas);
  return canvas;
}

export { shade };
