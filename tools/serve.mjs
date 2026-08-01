// A tiny static file server, built only from Node's own modules, so the game
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
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    process.stdout.write(
      `Port ${requested} is already in use.\nTry another one:  node tools/serve.mjs ${requested + 1}\n`
    );
    process.exit(1);
  }
  throw err;
});

/** Addresses another device on the same network can reach. */
function localAddresses() {
  const found = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}

// Listening on 0.0.0.0 lets a phone on the same Wi-Fi play too.
server.listen(requested, '0.0.0.0', () => {
  const { port } = server.address();
  const lines = [
    '',
    '  Aetherlings is running.',
    '',
    `  On this computer:      http://localhost:${port}`,
  ];
  const addresses = localAddresses();
  if (addresses.length) {
    lines.push('');
    lines.push('  On a phone or tablet on the same Wi-Fi:');
    for (const address of addresses) lines.push(`                         http://${address}:${port}`);
    lines.push('');
    lines.push('  (Windows may ask to allow Node through the firewall — say yes,');
    lines.push('   and tick "Private networks".)');
  }
  lines.push('');
  lines.push('  Press Ctrl+C here to stop the server.');
  lines.push('');
  process.stdout.write(lines.join('\n') + '\n');
});
