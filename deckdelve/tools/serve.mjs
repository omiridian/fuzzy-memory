// A tiny static file server built only from Node's own modules, so Deckdelve
// runs the same way on Windows, macOS and Linux with nothing installed.
//
//   node tools/serve.mjs            serves on http://localhost:8080
//   node tools/serve.mjs 3000       serves on a port of your choosing

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requested = Number(process.argv[2]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(root, url === '/' ? 'index.html' : url);

  // Never serve anything outside the project folder.
  if (!file.startsWith(root)) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('Forbidden');
    return;
  }

  try {
    const info = await stat(file);
    const target = info.isDirectory() ? path.join(file, 'index.html') : file;
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
});

/** The address a phone on the same Wi-Fi can reach. */
function lanAddress() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

function listen(port, attemptsLeft = 12) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      process.stdout.write(`port ${port} is busy, trying ${port + 1}\n`);
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    throw err;
  });
  server.listen(port, () => {
    const lan = lanAddress();
    process.stdout.write(`\nDeckdelve is running.\n`);
    process.stdout.write(`  http://localhost:${port}\n`);
    if (lan) process.stdout.write(`  http://${lan}:${port}   (same Wi-Fi, e.g. a tablet)\n`);
    process.stdout.write(`\nCtrl+C stops the server.\n`);
  });
}

listen(requested);
