// Proves the game actually makes a noise.
//
// The unit tests only prove the audio layer never crashes when there is no Web
// Audio. This boots a real browser, lets the engine build a real graph, taps an
// analyser onto the master bus, and measures the peak level each sound and each
// piece of music produces. A recipe with a bad envelope is silent, not broken,
// so nothing but listening catches it.
//
//   node tools/audio-check.mjs [--file dist/deckdelve.html]

import { chromium } from 'playwright';
import { SFX_NAMES } from '../src/audio/sfx.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const file = path.resolve(root, arg('--file', 'dist/deckdelve.html'));

const server = createServer(async (req, res) => {
  try {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
});

await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(500);

process.stdout.write('\nDeckdelve audio check\n');

// A real gesture, the way a player starts the sound.
await page.mouse.click(512, 400);
await page.waitForTimeout(400);

const state = await page.evaluate(() => {
  const a = window.deckdelve.audio;
  return { available: a.available, ctx: a.engine.ctx ? a.engine.ctx.state : 'none', muted: a.muted };
});
process.stdout.write(`  engine: ${JSON.stringify(state)}\n`);
if (!state.available) {
  process.stdout.write('\n  ✗ the audio graph never started in this browser\n');
  await browser.close();
  server.close();
  process.exit(1);
}

// Tap an analyser onto the master bus so we can hear what the page hears.
await page.evaluate(() => {
  const engine = window.deckdelve.audio.engine;
  const analyser = engine.ctx.createAnalyser();
  analyser.fftSize = 2048;
  engine.buses.master.connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  window.__peak = 0;
  window.__meter = () => {
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > window.__peak) window.__peak = peak;
    return peak;
  };
  window.__watch = setInterval(window.__meter, 12);
});

/** Plays one sound and reports the loudest moment it produced. */
async function measure(fn, ms) {
  await page.evaluate(() => {
    window.__peak = 0;
  });
  await page.evaluate(fn);
  await page.waitForTimeout(ms);
  return page.evaluate(() => window.__peak);
}

// The list comes from the source, so a new sound is covered the day it lands.
const sfxNames = SFX_NAMES;
const silent = [];
const quiet = [];
process.stdout.write(`  measuring ${sfxNames.length} sounds\n`);
for (const name of sfxNames) {
  // Clear the throttle so repeats of the same sound still fire.
  await page.evaluate(() => window.deckdelve.audio.engine.lastPlayed.clear());
  const peak = await measure(
    new Function(`window.deckdelve.audio.play(${JSON.stringify(name)})`),
    name === 'boss_die' || name === 'wipe' || name === 'victory' || name === 'biome' ? 700 : 380,
  );
  if (peak < 0.0005) silent.push(`${name} (peak ${peak.toFixed(5)})`);
  else if (peak < 0.005) quiet.push(`${name} (peak ${peak.toFixed(4)})`);
}
process.stdout.write(`  loudest-moment check done: ${silent.length} silent, ${quiet.length} very quiet\n`);

// The music, per track.
const music = {};
for (const track of ['title', 'guild', 'expedition']) {
  await page.evaluate((t) => {
    const a = window.deckdelve.audio;
    a.music.stop();
    a.music.setState({ threat: t === 'expedition' ? 65 : 0, combat: t === 'expedition', boss: false });
    a.setScene(t);
  }, track);
  music[track] = await measure(() => {}, 3200);
}
process.stdout.write(`  music peaks: ${JSON.stringify(
  Object.fromEntries(Object.entries(music).map(([k, v]) => [k, Number(v.toFixed(4))])),
)}\n`);

// And muting really does silence it. The fade takes a moment and the analyser
// holds the last fraction of a second, so let both clear before measuring —
// otherwise this measures the sound that was already in the air.
await page.evaluate(() => {
  window.deckdelve.audio.setScene('expedition');
  window.deckdelve.audio.setEnabled(false);
});
await page.waitForTimeout(600);
const mutedPeak = await measure(() => window.deckdelve.audio.play('boss_intro'), 900);
await page.evaluate(() => window.deckdelve.audio.setEnabled(true));
process.stdout.write(`  muted peak: ${mutedPeak.toFixed(5)}\n`);

await browser.close();
server.close();

const problems = [];
if (silent.length) problems.push(`silent sounds: ${silent.join(', ')}`);
for (const [track, peak] of Object.entries(music)) {
  if (peak < 0.002) problems.push(`the ${track} music produced nothing (peak ${peak.toFixed(5)})`);
}
if (mutedPeak > 0.002) problems.push(`muting did not silence the game (peak ${mutedPeak.toFixed(4)})`);
if (errors.length) problems.push(...errors.map((e) => `browser error: ${e}`));

if (problems.length) {
  process.stdout.write(`\n${problems.length} problems:\n`);
  for (const p of problems) process.stdout.write(`  ✗ ${p}\n`);
  process.exit(1);
}
if (quiet.length) process.stdout.write(`  note — very quiet: ${quiet.join(', ')}\n`);
process.stdout.write('\nAll clear. Everything makes a noise, and muting stops it.\n');
