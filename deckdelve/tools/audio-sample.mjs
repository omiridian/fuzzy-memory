// Records a short excerpt of the game's audio to a file, so the score can be
// listened to without playing a whole expedition. Purely a demo tool.
//
//   node tools/audio-sample.mjs [--out deckdelve-sample.webm]

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const file = path.resolve(root, arg('--file', 'dist/deckdelve.html'));
const outFile = path.resolve(arg('--out', path.join(root, 'deckdelve-sample.wav')));

const server = createServer(async (req, res) => {
  try {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.mouse.click(512, 400);
await page.waitForTimeout(300);

process.stdout.write('\nRecording an excerpt…\n');

const base64 = await page.evaluate(async () => {
  const audio = window.deckdelve.audio;
  const engine = audio.engine;
  const sink = engine.ctx.createMediaStreamDestination();
  engine.buses.master.connect(sink);

  const chunks = [];
  const recorder = new MediaRecorder(sink.stream, { mimeType: 'audio/webm' });
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const at = (ms, fn) => setTimeout(fn, ms);

  recorder.start();

  // 1. The title screen: sparse, and in no hurry.
  audio.music.stop();
  audio.setScene('title');
  await wait(6500);

  // 2. The guild hall between runs.
  audio.setScene('guild');
  at(1200, () => audio.play('ui_select'));
  at(2400, () => audio.play('gear'));
  at(4000, () => audio.play('level_up'));
  await wait(6500);

  // 3. Down we go — Threat climbing, a fight, and a room combining.
  audio.setScene('expedition');
  audio.music.setState({ threat: 12, combat: false, boss: false, mode: 'aeolian' });
  at(600, () => audio.play('card_place'));
  at(2200, () => audio.play('room_enter'));
  at(3400, () => audio.play('loot'));
  await wait(6000);

  audio.music.setState({ threat: 46, combat: true, mode: 'phrygian' });
  for (let i = 0; i < 10; i++) {
    at(400 + i * 620, () => {
      engine.lastPlayed.clear();
      audio.play(i % 4 === 3 ? 'hit_crit' : 'hit_melee');
    });
    at(700 + i * 620, () => {
      engine.lastPlayed.clear();
      audio.play('hurt');
    });
  }
  at(2600, () => audio.play('enemy_die'));
  at(5200, () => audio.play('heal'));
  await wait(7000);

  // 4. A biome forms, and then the thing at the bottom notices.
  audio.play('biome');
  audio.music.setState({ threat: 74, combat: false });
  await wait(4500);

  audio.play('boss_intro');
  audio.music.setState({ threat: 88, combat: true, boss: true, mode: 'harmonic' });
  await wait(7000);

  audio.play('boss_die');
  await wait(3500);
  audio.music.stop();
  audio.play('victory');
  await wait(4000);

  recorder.stop();
  await wait(400);

  // MediaRecorder gives webm; decode it and hand back plain WAV, which plays
  // anywhere without a codec argument.
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const encoded = await blob.arrayBuffer();
  const decoder = new OfflineAudioContext(1, 1, 44100);
  const decoded = await decoder.decodeAudioData(encoded);

  const samples = decoded.getChannelData(0);
  const rate = decoded.sampleRate;
  const wav = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(wav);
  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  let binary = '';
  const bytes = new Uint8Array(wav);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
});

await browser.close();
server.close();

const bytes = Buffer.from(base64, 'base64');
await writeFile(outFile, bytes);
process.stdout.write(`Wrote ${path.relative(process.cwd(), outFile)} (${(bytes.length / 1024).toFixed(0)} KB)\n`);
