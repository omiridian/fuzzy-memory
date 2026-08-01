// Browser smoke test: boots the game in Chromium, plays through the opening
// (name → starter → walk out of the house), forces a battle, and screenshots
// each step. Fails on any console error or uncaught exception.
//
//   node tools/smoke.mjs [--keep] [--out dir]

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });

const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`uncaught: ${err.message}`));

// The title screen asks for a name via window.prompt.
await page.addInitScript(() => {
  window.prompt = () => 'Rowan';
});

const shot = async (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const key = async (k, times = 1, delay = 130) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(k);
    await page.waitForTimeout(delay);
  }
};
const hold = async (k, ms) => {
  await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  await page.keyboard.up(k);
  await page.waitForTimeout(150);
};

const step = (label) => process.stdout.write(`  · ${label}\n`);

/** Presses through any open dialogue until the overworld is idle again. */
const clearDialogue = async () => {
  for (let i = 0; i < 25; i++) {
    const busy = await page.evaluate(() => {
      const app = window.aetherlings.app;
      return !!(app.overworld && app.overworld.textBox.isBusy);
    });
    if (!busy) return;
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(180);
  }
};

await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.aetherlings !== undefined, { timeout: 15000 });
await page.waitForTimeout(600);
step('title screen');
await shot('01-title');

// New Game is the second entry when a save exists, the first when it does not.
await key('ArrowDown');
await key('ArrowUp');
await key('KeyZ');
await page.waitForTimeout(900);
step('game started');
await shot('02-house');

const state = () =>
  page.evaluate(() => {
    const app = window.aetherlings.app;
    return {
      scenes: app.scenes.map((s) => s.constructor.name),
      map: app.game ? app.game.mapId : null,
      party: app.game ? app.game.party.mons.map((m) => `${m.species} L${m.level}`) : [],
      money: app.game ? app.game.bag.money : 0,
      caught: app.game ? app.game.caughtCount() : 0,
      quests: app.game ? app.game.quests.activeList().map((q) => q.name) : [],
    };
  });

let s = await state();
if (!s.map) throw new Error('the game never started');
step(`in ${s.map}`);

// Walk out of the house: down to the door.
await hold('ArrowDown', 900);
await page.waitForTimeout(900);
s = await state();
step(`walked to ${s.map}`);
await shot('03-town');

// Jump straight into the lab and take a starter through the scripted flow.
await page.evaluate(() => {
  const app = window.aetherlings.app;
  app.overworld.enterMap('lab', 7, 6, { silent: true });
  app.game.dir = 'up';
});
await page.waitForTimeout(400);
await shot('04-lab');

// Stand in front of Aldrin and hear her out.
await page.evaluate(() => {
  const app = window.aetherlings.app;
  const npc = app.overworld.map.npcs.find((n) => n.id === 'aldrin');
  app.game.x = npc.x;
  app.game.y = npc.y + 1;
  app.game.dir = 'up';
});
await page.waitForTimeout(250);
await key('KeyZ', 8, 220);
await page.waitForTimeout(300);
await shot('05-aldrin');

// Face the starter case and choose the first partner.
await page.evaluate(() => {
  const app = window.aetherlings.app;
  const npc = app.overworld.map.npcs.find((n) => n.id === 'starter_case');
  app.game.x = npc.x;
  app.game.y = npc.y + 1;
  app.game.dir = 'up';
});
await page.waitForTimeout(250);
await key('KeyZ', 3, 250);
await shot('06-starter-choice');
await key('KeyZ', 4, 250);
await page.waitForTimeout(400);
s = await state();
step(`party: ${s.party.join(', ') || '(empty)'}`);
await shot('07-starter-taken');
if (!s.party.length) throw new Error('choosing a starter did not add a creature');

// Menu screens.
await clearDialogue();
await key('KeyM');
await page.waitForTimeout(300);
await shot('08-menu');
await key('KeyZ'); // Party
await page.waitForTimeout(400);
await shot('09-party');
await key('KeyZ'); // Summary
await page.waitForTimeout(300);
await shot('10-summary');
await key('ArrowRight');
await page.waitForTimeout(250);
await shot('11-summary-moves');
await key('KeyX', 3, 200);

// The Ledger.
await key('KeyM');
await page.waitForTimeout(250);
await key('ArrowDown', 2, 150);
await key('KeyZ');
await page.waitForTimeout(400);
await shot('12-ledger');
await key('KeyX', 2, 200);

// Walk the tall grass on Meadow Road until something jumps out.
await page.evaluate(() => {
  const app = window.aetherlings.app;
  while (app.scenes.length > 1) app.pop();
  app.overworld.enterMap('route1', 14, 12, { silent: true });
});
await page.waitForTimeout(400);
await hold('ArrowLeft', 700);
await hold('ArrowUp', 1400);
await hold('ArrowDown', 1400);
await page.waitForTimeout(800);
s = await state();
if (!s.scenes.includes('BattleScene')) {
  // Encounters are random; force one so the screenshot is reliable.
  await page.evaluate(() => {
    const app = window.aetherlings.app;
    app.overworld.startWildBattle({ encounter: 'grass' });
  });
  await page.waitForTimeout(1200);
}
await key('KeyZ', 4, 350);
s = await state();
step(`scene stack: ${s.scenes.join(' > ')}`);
await shot('13-battle');

if (s.scenes.includes('BattleScene')) {
  await key('KeyZ', 2, 350); // Fight
  await shot('14-battle-moves');
  await key('KeyZ', 6, 450); // pick a move and read the log
  await shot('15-battle-turn');
}

// A trainer battle, start to finish: dialogue, fight, reward, after-line.
await page.evaluate(() => {
  const app = window.aetherlings.app;
  while (app.scenes.length > 1) app.pop();
  // Give the party enough muscle to actually win the fight.
  const mon = app.game.party.mons[0];
  mon.level = 40;
  window.aetherlings.refresh(mon);
  const npc = app.overworld.map.npcs.find((n) => n.trainer);
  app.game.x = npc.x;
  app.game.y = npc.y + 1;
  app.game.dir = 'up';
});
await page.waitForTimeout(250);
await key('KeyZ', 3, 250);
let sceneNames = (await state()).scenes;
if (!sceneNames.includes('BattleScene')) await key('KeyZ', 3, 300);
await shot('16-trainer-battle');
for (let i = 0; i < 40; i++) {
  const now = await state();
  if (!now.scenes.includes('BattleScene')) break;
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(200);
}
await clearDialogue();
const afterTrainer = await state();
step(`trainer battle resolved, back to ${afterTrainer.scenes.join(' > ')}`);
await shot('17-after-trainer');

// Shop.
await page.evaluate(() => {
  const app = window.aetherlings.app;
  while (app.scenes.length > 1) app.pop();
  app.push(app.makeShopScene(['orb', 'potion', 'superpotion', 'revive']));
});
await page.waitForTimeout(300);
await shot('18-shop');
await key('KeyZ', 2, 250);
await page.waitForTimeout(200);
const money = (await state()).money;
step(`money after shopping: ${money}`);

// Save and reload to prove persistence.
await page.evaluate(() => {
  const app = window.aetherlings.app;
  while (app.scenes.length > 1) app.pop();
  app.saveGame();
});
await page.waitForTimeout(300);
const before = await state();
await page.reload();
await page.waitForFunction(() => window.aetherlings !== undefined);
await page.waitForTimeout(600);
await key('KeyZ'); // Continue
await page.waitForTimeout(800);
const after = await state();
step(`reloaded with ${after.party.length} creature(s) in ${after.map}`);
await shot('19-after-reload');

if (after.party.length !== before.party.length) {
  problems.push('the save did not restore the party');
}

await browser.close();
server.close();

if (problems.length) {
  process.stdout.write(`\nFAILED:\n${problems.map((p) => '  ' + p).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`\nSmoke test passed. Screenshots in ${path.relative(root, outDir)}/\n`);
