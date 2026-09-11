// Rolls the game up into one self-contained HTML file.
//
//   node tools/bundle.mjs [--out dist/deckdelve.html]
//
// The modules are flattened into a single script in dependency order, which
// works because the source only ever uses static imports of named bindings and
// keeps its top-level names distinct. The bundler checks that second part
// rather than trusting it: a duplicate declaration fails the build instead of
// silently shadowing something at three in the morning.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const outFile = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(root, 'dist', 'deckdelve.html');
const entry = path.join(root, 'src', 'main.js');

const IMPORT_RE = /^\s*import\s+([\s\S]*?)\s+from\s+['"](.+?)['"];?\s*$/gm;
const BARE_IMPORT_RE = /^\s*import\s+['"](.+?)['"];?\s*$/gm;
const EXPORT_LIST_RE = /^\s*export\s*\{[\s\S]*?\};?\s*$/gm;
const EXPORT_DECL_RE = /^(\s*)export\s+(const|let|var|function|class|async\s+function)\b/gm;

/** Pulls the specifiers out of one import clause, aliases included. */
function parseClause(clause) {
  const named = [];
  const braces = clause.match(/\{([\s\S]*?)\}/);
  if (braces) {
    for (const part of braces[1].split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const m = piece.match(/^(\S+)\s+as\s+(\S+)$/);
      if (m) named.push({ from: m[1], as: m[2] });
      else named.push({ from: piece, as: piece });
    }
  }
  return named;
}

const modules = new Map();

async function collect(file) {
  const key = path.resolve(file);
  if (modules.has(key)) return modules.get(key);
  const placeholder = { key, deps: [], source: '', aliases: [] };
  modules.set(key, placeholder);

  const source = await readFile(key, 'utf8');
  const deps = [];
  const aliases = [];

  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(source))) {
    const [, clause, specifier] = match;
    if (!specifier.startsWith('.')) {
      throw new Error(`${path.relative(root, key)}: bare import "${specifier}" cannot be bundled`);
    }
    const resolved = path.resolve(path.dirname(key), specifier);
    deps.push(resolved);
    for (const spec of parseClause(clause)) {
      if (spec.from !== spec.as) aliases.push(`const ${spec.as} = ${spec.from};`);
    }
  }
  BARE_IMPORT_RE.lastIndex = 0;
  while ((match = BARE_IMPORT_RE.exec(source))) {
    deps.push(path.resolve(path.dirname(key), match[1]));
  }

  placeholder.deps = deps;
  placeholder.aliases = aliases;
  placeholder.source = source
    .replace(IMPORT_RE, '')
    .replace(BARE_IMPORT_RE, '')
    .replace(EXPORT_LIST_RE, '')
    .replace(EXPORT_DECL_RE, '$1$2');

  for (const dep of deps) await collect(dep);
  return placeholder;
}

/** Depth-first, dependencies before dependants. */
function order(startKey) {
  const out = [];
  const state = new Map();
  const visit = (key) => {
    const mark = state.get(key);
    if (mark === 'done') return;
    if (mark === 'open') return; // a cycle: the source has none, and a repeat would be worse
    state.set(key, 'open');
    const mod = modules.get(key);
    for (const dep of mod.deps) visit(dep);
    state.set(key, 'done');
    out.push(mod);
  };
  visit(path.resolve(startKey));
  return out;
}

const TOP_LEVEL_RE = /^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm;

function checkForCollisions(ordered) {
  const seen = new Map();
  const clashes = [];
  for (const mod of ordered) {
    TOP_LEVEL_RE.lastIndex = 0;
    let m;
    while ((m = TOP_LEVEL_RE.exec(mod.source))) {
      const name = m[1];
      if (seen.has(name)) clashes.push(`${name} (${seen.get(name)} and ${path.relative(root, mod.key)})`);
      else seen.set(name, path.relative(root, mod.key));
    }
  }
  return clashes;
}

await collect(entry);
const ordered = order(entry);
const clashes = checkForCollisions(ordered);
if (clashes.length) {
  process.stderr.write(`\nTop-level names declared twice — rename one of each before bundling:\n`);
  for (const c of clashes) process.stderr.write(`  ${c}\n`);
  process.exit(1);
}

const banner = `// Deckdelve — bundled from ${ordered.length} modules. Source: deckdelve/src/`;
const body = ordered
  .map((mod) => {
    const name = path.relative(root, mod.key);
    const aliases = mod.aliases.length ? `\n${mod.aliases.join('\n')}\n` : '';
    return `\n// ${'='.repeat(72)}\n// ${name}\n// ${'='.repeat(72)}\n${aliases}${mod.source.trim()}\n`;
  })
  .join('\n');

const script = `${banner}\n(function () {\n'use strict';\n${body}\n})();\n`;

const html = await readFile(path.join(root, 'index.html'), 'utf8');
const out = html.replace(
  /<script type="module" src="\.\/src\/main\.js"><\/script>/,
  `<script>\n${script}\n</script>`,
);
if (out === html) throw new Error('index.html did not contain the module script tag to replace');

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, out, 'utf8');
const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(0);
process.stdout.write(`\nBundled ${ordered.length} modules into ${path.relative(process.cwd(), outFile)} (${kb} KB)\n`);
