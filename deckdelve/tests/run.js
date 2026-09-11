// Test runner: imports every *.test.js in this folder and reports the tally.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { summary } from './harness.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

for (const file of files) {
  await import(pathToFileURL(path.join(dir, file)).href);
}

const state = summary();
process.stdout.write(`\n${state.passed} passed, ${state.failed} failed\n`);
if (state.failed) process.exit(1);
