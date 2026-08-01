// Renders the game at several window sizes and walks out of the front door,
// so layout regressions and blocked-in doorways are visible in screenshots.
//
//   node tools/checklayout.mjs

import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'screenshots');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(root, decodeURIComponent(url));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const problems = [];

const CASES = [
  { name: 'desktop-1920', viewport: { width: 1920, height: 1080 } },
  { name: 'laptop-1366', viewport: { width: 1366, height: 768 } },
  { name: 'phone-portrait', ...devices['Pixel 5'] },
  { name: 'phone-landscape', ...devices['Pixel 5 landscape'] },
];

for (const testCase of CASES) {
  const { name, ...options } = testCase;
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', (err) => problems.push(`${name}: ${err.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: ${m.text()}`));
  await page.addInitScript(() => {
    window.prompt = () => 'Rowan';
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.aetherlings !== undefined);
  await page.waitForTimeout(500);

  const touch = options.isMobile || options.hasTouch;
  const tap = async (label) => {
    const button = page.locator(`#touch [data-key="${label}"]`);
    await button.dispatchEvent('pointerdown');
    await page.waitForTimeout(120);
    await button.dispatchEvent('pointerup');
    await page.waitForTimeout(120);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i++) {
      if (touch) await tap(key === 'KeyZ' ? 'confirm' : key === 'ArrowDown' ? 'down' : 'up');
      else await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }
  };

  await press('KeyZ'); // New Game
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, `layout-${name}-house.png`) });

  // Walk out of the front door and check we land in the street, not inside
  // the building's own footprint.
  if (touch) {
    const down = page.locator('#touch [data-key="down"]');
    await down.dispatchEvent('pointerdown');
    await page.waitForTimeout(1600);
    await down.dispatchEvent('pointerup');
  } else {
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(1600);
    await page.keyboard.up('ArrowDown');
  }
  await page.waitForTimeout(900);

  const where = await page.evaluate(() => {
    const app = window.aetherlings.app;
    const map = app.overworld.map;
    const { x, y } = app.game;
    // How many directions can we actually walk from here?
    let open = 0;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const row = map.tiles[y + dy];
      const ch = row && row[x + dx];
      if (ch && !'#|%MTRrw~W'.includes(ch)) open++;
    }
    return { map: app.game.mapId, x, y, open, canvas: { w: app.canvas.width, h: app.canvas.height }, scale: app.renderScale };
  });

  const label = `${name.padEnd(16)} map=${where.map.padEnd(12)} at ${where.x},${where.y} exits=${where.open} canvas=${where.canvas.w}x${where.canvas.h} scale=${where.scale.toFixed(2)}`;
  process.stdout.write(`  ${label}\n`);
  if (where.map === 'hearthvale' && where.open < 2) {
    problems.push(`${name}: only ${where.open} way(s) out after leaving the house`);
  }
  await page.screenshot({ path: path.join(outDir, `layout-${name}-outside.png`) });
  await context.close();
}

await browser.close();
server.close();

if (problems.length) {
  process.stdout.write(`\nFAILED:\n${problems.map((p) => '  ' + p).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('\nLayout check passed.\n');
