// Browser smoke test: boots the real game in Chromium, walks the whole loop —
// title, guild, deck, descend, build rooms, watch a fight, extract, debrief,
// reload and check the save survived — and screenshots each step.
//
// Fails on any console error or uncaught exception.
//
//   node tools/smoke.mjs [--out dir] [--headed]
//
// Needs Playwright and a Chromium. It is not part of `npm test`, which runs
// headless under plain Node.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : path.join(root, 'screenshots');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(root, decodeURIComponent(url));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const base = `http://localhost:${port}`;

const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (err) => problems.push(`uncaught: ${err.message}`));

const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const step = (msg) => process.stdout.write(`  ${msg}\n`);

/** Reads something out of the live game. */
const peek = (fn, arg) => page.evaluate(fn, arg);

process.stdout.write('\nDeckdelve smoke test\n');

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  try {
    localStorage.clear();
  } catch {
    /* private window; the game copes */
  }
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await shot('01-title');
step('title screen up');

await page.mouse.click(512, 393);
await page.waitForTimeout(400);
let scene = await peek(() => window.deckdelve.scene.constructor.name);
if (scene !== 'GuildScene') throw new Error(`expected the guild hall, got ${scene}`);
await shot('02-guild');
step('guild hall: roster');

for (const [i, name] of [[1, '03-deck'], [2, '04-shop'], [3, '05-wall']]) {
  await page.mouse.click(103 + i * 132, 92);
  await page.waitForTimeout(250);
  await shot(name);
}
step('guild hall: deck, requisitions, the wall');

await page.mouse.click(103, 92);
await page.waitForTimeout(150);
await page.mouse.click(1024 - 150, 640 - 32);
await page.waitForTimeout(700);
scene = await peek(() => window.deckdelve.scene.constructor.name);
if (scene !== 'ExpeditionScene') throw new Error(`expected an expedition, got ${scene}`);
await shot('06-expedition');
step('descended');

// Hold a card and check the game offers somewhere legal to put it.
await page.keyboard.press('Digit1');
await page.waitForTimeout(250);
const legal = await peek(() => window.deckdelve.scene.legal.length);
if (!legal) throw new Error('an opening hand with nowhere to build');
const spot = await peek((cell) => {
  const s = window.deckdelve.scene;
  return s.camera.toScreen(cell.x * 144 + 72, cell.y * 144 + 72);
}, await peek(() => window.deckdelve.scene.legal[0]));
await page.mouse.move(spot.x, spot.y);
await page.waitForTimeout(200);
await shot('07-ghost');
await page.mouse.click(spot.x, spot.y);
await page.waitForTimeout(600);
await shot('08-placed');
if (!(await peek(() => window.deckdelve.scene.exp.roomsPlaced))) throw new Error('the card did not land');
step('built a room by hand');

// Then let it play, building outwards, at speed.
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
for (let round = 0; round < 20; round++) {
  await page.evaluate(() => {
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
          const far = s.legal
            .slice()
            .sort((a, b) => Math.abs(b.x) + Math.abs(b.y) - Math.abs(a.x) - Math.abs(a.y))[0];
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
await shot('09-underway');

const mid = await peek(() => {
  const e = window.deckdelve.scene.exp;
  return {
    rooms: e.dungeon.rooms.size,
    entered: [...e.dungeon.rooms.values()].filter((r) => r.entered).length,
    depth: e.dungeon.deepestEntered(),
    kills: e.kills,
    threat: Math.round(e.threat.value),
    gold: Math.round(e.party.reduce((a, p) => a + p.carriedGold, 0)),
    alive: e.living.length,
  };
});
step(`underway: ${JSON.stringify(mid)}`);
if (mid.entered < 3) throw new Error('the party never got past the first room');
if (!mid.kills) throw new Error('nothing was fought');

await page.keyboard.press('Slash');
await page.waitForTimeout(200);
await shot('10-help');
await page.mouse.click(512, 300);

// Extract, and wait for the debrief.
await page.mouse.click(1024 - 47, 19);
for (let i = 0; i < 60; i++) {
  const done = await peek(() => window.deckdelve.scene.constructor.name === 'ResultsScene');
  if (done) break;
  await page.waitForTimeout(500);
}
scene = await peek(() => window.deckdelve.scene.constructor.name);
if (scene !== 'ResultsScene') throw new Error('the expedition never ended');
await page.waitForTimeout(400);
await shot('11-results');
step('extracted and debriefed');

await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await shot('12-guild-after');

const saved = await peek(() => ({
  gold: window.deckdelve.guild.gold,
  runs: window.deckdelve.guild.runs,
}));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const reloaded = await peek(() => ({
  gold: window.deckdelve.guild.gold,
  runs: window.deckdelve.guild.runs,
}));
if (reloaded.runs !== saved.runs || reloaded.gold !== saved.gold) {
  throw new Error(`the save did not survive a reload: ${JSON.stringify(saved)} vs ${JSON.stringify(reloaded)}`);
}
step(`save survived a reload (${reloaded.gold} gold, ${reloaded.runs} run)`);

await browser.close();
server.close();

if (problems.length) {
  process.stdout.write(`\n${problems.length} browser problems:\n`);
  for (const p of problems) process.stdout.write(`  ✗ ${p}\n`);
  process.exit(1);
}
process.stdout.write(`\nAll clear. Screenshots in ${outDir}\n`);
