// Drives the bundled game as a phone would: real touch pointers, taps,
// press-and-hold, drags and a pinch, at 390×844 and again in landscape.
//
//   node tools/mobile-check.mjs [--out dir] [--file dist/deckdelve.html]
//
// Needs Playwright and a Chromium. Not part of `npm test`.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const outDir = path.resolve(arg('--out', path.join(root, 'screenshots')));
const file = path.resolve(root, arg('--file', 'dist/deckdelve.html'));
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const problems = [];
const step = (msg) => process.stdout.write(`  ${msg}\n`);

/** Dispatches a real touch pointer at a point in the game's own coordinates. */
const TOUCH_HELPERS = `
window.__t = {
  at(lx, ly) {
    const s = window.deckdelve.scale;
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.left + lx * s, y: r.top + ly * s };
  },
  send(type, id, lx, ly) {
    const p = this.at(lx, ly);
    const el = document.getElementById('game');
    el.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: id === 1,
      clientX: p.x, clientY: p.y, button: 0,
      buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
    }));
  },
};
`;

async function session(page, label, shots) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`${label} console: ${m.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`${label} uncaught: ${err.message}`));
  await page.goto(base, { waitUntil: 'load' });
  await page.addScriptTag({ content: TOUCH_HELPERS });
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* private mode */
    }
  });
  await page.reload({ waitUntil: 'load' });
  await page.addScriptTag({ content: TOUCH_HELPERS });
  await page.waitForTimeout(600);
  return errors;
}

const tap = (page, x, y) =>
  page.evaluate(
    ([lx, ly]) => {
      window.__t.send('pointerdown', 1, lx, ly);
      setTimeout(() => window.__t.send('pointerup', 1, lx, ly), 60);
    },
    [x, y],
  );

const hold = (page, x, y, ms = 700) =>
  page.evaluate(
    ([lx, ly, wait]) =>
      new Promise((resolve) => {
        window.__t.send('pointerdown', 1, lx, ly);
        setTimeout(() => {
          window.__t.send('pointerup', 1, lx, ly);
          resolve();
        }, wait);
      }),
    [x, y, ms],
  );

const drag = (page, x, y, dx, dy) =>
  page.evaluate(
    ([lx, ly, ddx, ddy]) =>
      new Promise((resolve) => {
        window.__t.send('pointerdown', 1, lx, ly);
        let i = 1;
        const tick = () => {
          window.__t.send('pointermove', 1, lx + (ddx * i) / 8, ly + (ddy * i) / 8);
          if (i++ < 8) setTimeout(tick, 16);
          else {
            window.__t.send('pointerup', 1, lx + ddx, ly + ddy);
            resolve();
          }
        };
        setTimeout(tick, 16);
      }),
    [x, y, dx, dy],
  );

const pinch = (page, cx, cy, spread) =>
  page.evaluate(
    ([x, y, s]) =>
      new Promise((resolve) => {
        window.__t.send('pointerdown', 1, x - 30, y);
        window.__t.send('pointerdown', 2, x + 30, y);
        let i = 1;
        const tick = () => {
          const d = 30 + (s * i) / 8;
          window.__t.send('pointermove', 1, x - d, y);
          window.__t.send('pointermove', 2, x + d, y);
          if (i++ < 8) setTimeout(tick, 16);
          else {
            window.__t.send('pointerup', 1, x - d, y);
            window.__t.send('pointerup', 2, x + d, y);
            resolve();
          }
        };
        setTimeout(tick, 16);
      }),
    [cx, cy, spread],
  );

const peek = (page, fn, a) => page.evaluate(fn, a);

process.stdout.write('\nDeckdelve on a phone\n');

// ---------------------------------------------------------------------------
// Portrait
// ---------------------------------------------------------------------------
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await phone.newPage();
problems.push(...(await session(page, 'portrait')));

const size = await peek(page, () => ({
  w: window.deckdelve.width,
  h: window.deckdelve.height,
  compact: window.deckdelve.compact,
  scale: Number(window.deckdelve.scale.toFixed(3)),
}));
step(`portrait logical space: ${JSON.stringify(size)}`);
if (!size.compact) problems.push('portrait did not choose the compact layout');
await page.screenshot({ path: path.join(outDir, 'm01-title.png') });

// Title -> guild
const playBtn = await peek(page, () => window.deckdelve.scene.buttons.play);
await tap(page, playBtn.x + playBtn.w / 2, playBtn.y + playBtn.h / 2);
await page.waitForTimeout(400);
let scene = await peek(page, () => window.deckdelve.scene.constructor.name);
if (scene !== 'GuildScene') problems.push(`tap on the title did not open the guild (got ${scene})`);
step('tapped into the guild hall');
await page.screenshot({ path: path.join(outDir, 'm02-guild.png') });

// Tabs, and a sheet
const tabs = await peek(page, () => window.deckdelve.scene.rects.tab);
for (const [i, name] of [[1, 'm03-deck.png'], [2, 'm04-shop.png'], [3, 'm05-wall.png']]) {
  await tap(page, tabs[i].x + tabs[i].w / 2, tabs[i].y + tabs[i].h / 2);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, name) });
}
// Deck sheet
await tap(page, tabs[1].x + tabs[1].w / 2, tabs[1].y + tabs[1].h / 2);
await page.waitForTimeout(250);
const showDeck = await peek(page, () => window.deckdelve.scene.rects.showDeck);
if (showDeck) {
  await tap(page, showDeck.x + showDeck.w / 2, showDeck.y + showDeck.h / 2);
  await page.waitForTimeout(300);
  const sheet = await peek(page, () => (window.deckdelve.scene.sheet || {}).kind);
  if (sheet !== 'deck') problems.push('the deck sheet did not open');
  await page.screenshot({ path: path.join(outDir, 'm06-deck-sheet.png') });
  await tap(page, 200, 780);
  await page.waitForTimeout(200);
}
// Roster sheet
await tap(page, tabs[0].x + tabs[0].w / 2, tabs[0].y + tabs[0].h / 2);
await page.waitForTimeout(250);
const row = await peek(page, () => window.deckdelve.scene.rects.roster[0]);
await tap(page, row.x + 60, row.y + 20);
await page.waitForTimeout(300);
const advSheet = await peek(page, () => (window.deckdelve.scene.sheet || {}).kind);
if (advSheet !== 'adventurer') problems.push('tapping a roster row did not open the detail sheet');
step('roster and deck sheets open on a tap');
await page.screenshot({ path: path.join(outDir, 'm07-adventurer.png') });
const close = await peek(page, () => window.deckdelve.scene.rects.closeSheet);
await tap(page, close.x + close.w / 2, close.y + close.h / 2);
await page.waitForTimeout(250);

// Descend
const descend = await peek(page, () => window.deckdelve.scene.rects.descend);
await tap(page, descend.x + descend.w / 2, descend.y + descend.h / 2);
await page.waitForTimeout(700);
scene = await peek(page, () => window.deckdelve.scene.constructor.name);
if (scene !== 'ExpeditionScene') problems.push(`descend did not start an expedition (got ${scene})`);
step('descended');
await page.screenshot({ path: path.join(outDir, 'm08-expedition.png') });

// Tap a card, then a legal cell
const card0 = await peek(page, () => window.deckdelve.scene.hudRects.hand.cardRects[0]);
await tap(page, card0.x + card0.w / 2, card0.y + card0.h / 2);
await page.waitForTimeout(300);
const held = await peek(page, () => ({ held: !!window.deckdelve.scene.heldCard, legal: window.deckdelve.scene.legal.length }));
if (!held.held) problems.push('tapping a card did not pick it up');
if (!held.legal) problems.push('a held card offered nowhere to build');
step(`card in hand, ${held.legal} legal cells`);
await page.screenshot({ path: path.join(outDir, 'm09-card-held.png') });

const cellPoint = await peek(
  page,
  (cell) => {
    const s = window.deckdelve.scene;
    return s.camera.toScreen(cell.x * 144 + 72, cell.y * 144 + 72);
  },
  await peek(page, () => window.deckdelve.scene.legal[0]),
);
await tap(page, cellPoint.x, cellPoint.y);
await page.waitForTimeout(600);
if (!(await peek(page, () => window.deckdelve.scene.exp.roomsPlaced))) {
  problems.push('tapping a legal cell did not build the room');
}
step('built a room with two taps');
await page.screenshot({ path: path.join(outDir, 'm10-placed.png') });

// Drag to pan, pinch to zoom
const before = await peek(page, () => ({ x: window.deckdelve.scene.camera.x, zoom: window.deckdelve.scene.camera.zoom }));
await drag(page, 195, 420, -90, -60);
await page.waitForTimeout(200);
const panned = await peek(page, () => ({ x: window.deckdelve.scene.camera.x, follow: window.deckdelve.scene.camera.follow }));
if (Math.abs(panned.x - before.x) < 5) problems.push('dragging did not move the camera');
await pinch(page, 195, 420, 80);
await page.waitForTimeout(300);
const zoomed = await peek(page, () => window.deckdelve.scene.camera.zoom);
if (Math.abs(zoomed - before.zoom) < 0.05) problems.push('pinching did not zoom');
step(`drag panned the map, pinch took zoom ${before.zoom.toFixed(2)} → ${zoomed.toFixed(2)}`);

// Press and hold on the map = rally
await peek(page, () => {
  const s = window.deckdelve.scene;
  s.camera.recentre(s.exp.partyCentroid(), s.homeZoom);
});
await page.waitForTimeout(400);
await hold(page, 195, 400, 700);
await page.waitForTimeout(300);
const rallied = await peek(page, () => window.deckdelve.scene.exp.party.filter((a) => a.order === 'rally').length);
step(`press-and-hold put ${rallied} of them on a rally order`);
await page.screenshot({ path: path.join(outDir, 'm11-rally.png') });

// The Rally button arms a one-tap rally
const orders = await peek(page, () => window.deckdelve.scene.hudRects.orders.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, id: o.order.id })));
const rallyBtn = orders.find((o) => o.id === 'rally');
await tap(page, rallyBtn.x + rallyBtn.w / 2, rallyBtn.y + rallyBtn.h / 2);
await page.waitForTimeout(250);
if (!(await peek(page, () => window.deckdelve.scene.rallyArmed))) problems.push('the Rally button did not arm');
await page.screenshot({ path: path.join(outDir, 'm12-rally-armed.png') });
await tap(page, 195, 380);
await page.waitForTimeout(250);
if (await peek(page, () => window.deckdelve.scene.rallyArmed)) problems.push('the armed rally did not fire on the next tap');
step('the Rally button arms a one-tap rally');

// Orders, the menu sheet and help
const holdBtn = orders.find((o) => o.id === 'hold');
await tap(page, holdBtn.x + holdBtn.w / 2, holdBtn.y + holdBtn.h / 2);
await page.waitForTimeout(250);
const holding = await peek(page, () => window.deckdelve.scene.exp.living.every((a) => a.order === 'hold'));
if (!holding) problems.push('the Hold button did not reach the party');
const menu = await peek(page, () => window.deckdelve.scene.hudRects.top.menu);
await tap(page, menu.x + menu.w / 2, menu.y + menu.h / 2);
await page.waitForTimeout(250);
if (!(await peek(page, () => window.deckdelve.scene.menuOpen))) problems.push('the overflow menu did not open');
await page.screenshot({ path: path.join(outDir, 'm13-menu.png') });
const helpRow = await peek(page, () => window.deckdelve.scene.hudRects.sheet.help);
await tap(page, helpRow.x + helpRow.w / 2, helpRow.y + helpRow.h / 2);
await page.waitForTimeout(300);
if (!(await peek(page, () => window.deckdelve.scene.showHelp))) problems.push('help did not open from the menu');
step('overflow menu and help reachable by thumb');
await page.screenshot({ path: path.join(outDir, 'm14-help.png') });
await tap(page, 195, 300);
await page.waitForTimeout(200);

// Play on for a bit, then extract
await peek(page, () => {
  const s = window.deckdelve.scene;
  s.exp.setOrder(s.exp.living, 'explore');
  s.exp.speed = 3;
});
for (let i = 0; i < 12; i++) {
  await peek(page, () => {
    const s = window.deckdelve.scene;
    const exp = s.exp;
    if (!exp || exp.outcome) return;
    for (const entry of exp.deck.hand.slice()) {
      for (let rot = 0; rot < entry.rotations; rot++) {
        entry.rotation = rot;
        s.heldCard = entry.uid;
        s.legalKey = '';
        s.refreshLegal();
        if (s.legal.length) {
          const far = s.legal.slice().sort((a, b) => Math.abs(b.x) + Math.abs(b.y) - Math.abs(a.x) - Math.abs(a.y))[0];
          if (exp.placeCard(entry.uid, far.x, far.y).ok) {
            s.heldCard = null;
            s.legalKey = '';
            return;
          }
        }
      }
    }
    s.heldCard = null;
  });
  await page.waitForTimeout(700);
}
await page.screenshot({ path: path.join(outDir, 'm15-underway.png') });
const mid = await peek(page, () => {
  const e = window.deckdelve.scene.exp;
  return {
    entered: [...e.dungeon.rooms.values()].filter((r) => r.entered).length,
    kills: e.kills,
    threat: Math.round(e.threat.value),
  };
});
step(`underway: ${JSON.stringify(mid)}`);
if (mid.entered < 3) problems.push('the party never got past the first room on the phone build');

const extract = await peek(page, () => window.deckdelve.scene.hudRects.top.extract);
await tap(page, extract.x + extract.w / 2, extract.y + extract.h / 2);
for (let i = 0; i < 60; i++) {
  if (await peek(page, () => window.deckdelve.scene.constructor.name === 'ResultsScene')) break;
  await page.waitForTimeout(500);
}
scene = await peek(page, () => window.deckdelve.scene.constructor.name);
if (scene !== 'ResultsScene') problems.push('the expedition never ended on the phone build');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'm16-results.png') });
await drag(page, 195, 500, 0, -260);
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(outDir, 'm17-results-scrolled.png') });
step('debrief scrolls with a drag');

const back = await peek(page, () => window.deckdelve.scene.buttons.back);
await tap(page, back.x + back.w / 2, back.y + back.h / 2);
await page.waitForTimeout(400);
const saved = await peek(page, () => ({ gold: window.deckdelve.guild.gold, runs: window.deckdelve.guild.runs }));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(700);
const reloaded = await peek(page, () => ({ gold: window.deckdelve.guild.gold, runs: window.deckdelve.guild.runs }));
if (reloaded.runs !== saved.runs || reloaded.gold !== saved.gold) {
  problems.push(`the save did not survive a reload: ${JSON.stringify(saved)} vs ${JSON.stringify(reloaded)}`);
}
step(`save survived a reload (${reloaded.gold} gold, ${reloaded.runs} run)`);
await phone.close();

// ---------------------------------------------------------------------------
// Landscape
// ---------------------------------------------------------------------------
const land = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const lp = await land.newPage();
problems.push(...(await session(lp, 'landscape')));
const lsize = await peek(lp, () => ({ w: window.deckdelve.width, h: window.deckdelve.height, compact: window.deckdelve.compact }));
step(`landscape logical space: ${JSON.stringify(lsize)}`);
await lp.screenshot({ path: path.join(outDir, 'm18-landscape-title.png') });
const lplay = await peek(lp, () => window.deckdelve.scene.buttons.play);
await tap(lp, lplay.x + lplay.w / 2, lplay.y + lplay.h / 2);
await lp.waitForTimeout(400);
await lp.screenshot({ path: path.join(outDir, 'm19-landscape-guild.png') });
const lstate = await peek(lp, () => ({
  scene: window.deckdelve.scene.constructor.name,
  descend: window.deckdelve.scene.rects ? window.deckdelve.scene.rects.descend : null,
  party: window.deckdelve.guild.party.length,
  deck: window.deckdelve.guild.deck.length,
  err: String(window.deckdelve.error || ''),
}));
if (!lstate.descend) {
  problems.push(`landscape never reached the guild hall: ${JSON.stringify(lstate)}`);
} else {
  await tap(lp, lstate.descend.x + lstate.descend.w / 2, lstate.descend.y + lstate.descend.h / 2);
  await lp.waitForTimeout(800);
  const after = await peek(lp, () => ({
    scene: window.deckdelve.scene.constructor.name,
    message: window.deckdelve.scene.message || null,
    err: String(window.deckdelve.error || ''),
  }));
  if (after.scene !== 'ExpeditionScene') {
    problems.push(`landscape could not start an expedition: ${JSON.stringify({ ...lstate, ...after })}`);
  }
}
await lp.screenshot({ path: path.join(outDir, 'm20-landscape-expedition.png') });
step('landscape plays too');
await land.close();

// A narrow desktop window should still get the wide layout.
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dp = await desktop.newPage();
problems.push(...(await session(dp, 'desktop')));
const dsize = await peek(dp, () => ({ w: window.deckdelve.width, h: window.deckdelve.height, compact: window.deckdelve.compact }));
if (dsize.compact) problems.push('a desktop window got the phone layout');
step(`desktop logical space: ${JSON.stringify(dsize)}`);
await dp.screenshot({ path: path.join(outDir, 'm21-desktop.png') });
await desktop.close();

await browser.close();
server.close();

if (problems.length) {
  process.stdout.write(`\n${problems.length} problems:\n`);
  for (const p of problems) process.stdout.write(`  ✗ ${p}\n`);
  process.exit(1);
}
process.stdout.write(`\nAll clear. Screenshots in ${outDir}\n`);
