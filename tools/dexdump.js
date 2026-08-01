// Prints the roster to the terminal. Useful for balancing and for checking
// what the generator produced.
//
//   node tools/dexdump.js                 summary + first 40 entries
//   node tools/dexdump.js --all           every species
//   node tools/dexdump.js --id flarehound one species in full
//   node tools/dexdump.js --type ember    everything of a type
//   node tools/dexdump.js --json          machine-readable dump

import { DEX, DEX_ORDER, DEX_COUNT, evolutionLine } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';
import { ABILITIES } from '../src/data/abilities.js';
import { TYPES } from '../src/data/types.js';
import { dexNumber } from '../src/core/util.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

const all = DEX_ORDER.map((id) => DEX[id]);

if (flag('--json')) {
  process.stdout.write(JSON.stringify(all, null, 2));
  process.exit(0);
}

const single = value('--id');
if (single) {
  const species = DEX[single];
  if (!species) {
    process.stdout.write(`No species called "${single}".\n`);
    process.exit(1);
  }
  printFull(species);
  process.exit(0);
}

const typeFilter = value('--type');
let list = all;
if (typeFilter) list = all.filter((s) => s.types.includes(typeFilter));

printSummary();
const shown = flag('--all') || typeFilter ? list : list.slice(0, 40);
process.stdout.write('\n');
for (const species of shown) printRow(species);
if (shown.length < list.length) {
  process.stdout.write(`\n… ${list.length - shown.length} more. Pass --all to see everything.\n`);
}

function printSummary() {
  const byType = {};
  for (const t of TYPES) byType[t] = 0;
  let branching = 0;
  let finals = 0;
  let legendaries = 0;
  for (const s of all) {
    for (const t of s.types) byType[t]++;
    if (s.evolutions.length > 1) branching++;
    if (!s.evolutions.length && s.prevo) finals++;
    if (s.legendary) legendaries++;
  }
  process.stdout.write(`AETHERLINGS — ${DEX_COUNT} species\n`);
  process.stdout.write(`  ${finals} fully evolved · ${branching} branching lines · ${legendaries} legendary\n`);
  process.stdout.write(`  ${Object.keys(MOVES).length} moves · ${Object.keys(ABILITIES).length} abilities\n`);
  const spread = TYPES.map((t) => `${t} ${byType[t]}`).join('  ');
  process.stdout.write(`  types: ${spread}\n`);
  const bst = all.map((s) => s.bst);
  const avg = Math.round(bst.reduce((a, b) => a + b, 0) / bst.length);
  process.stdout.write(`  base stat totals: min ${Math.min(...bst)} · avg ${avg} · max ${Math.max(...bst)}\n`);
}

function printRow(s) {
  const types = s.types.join('/').padEnd(16);
  const evo = s.evolutions.map((e) => `→ ${DEX[e.to].name} (${e.note})`).join('  ');
  process.stdout.write(
    `${dexNumber(s.num)} ${s.name.padEnd(16)} ${types} BST ${String(s.bst).padStart(3)}  ${evo}\n`
  );
}

function printFull(s) {
  process.stdout.write(`${dexNumber(s.num)} ${s.name}  [${s.types.join('/')}]\n`);
  process.stdout.write(`${s.dex}\n\n`);
  process.stdout.write(
    `  stats   HP ${s.stats.hp}  ATK ${s.stats.atk}  DEF ${s.stats.def}  SPA ${s.stats.spa}  SPD ${s.stats.spd}  SPE ${s.stats.spe}   (BST ${s.bst})\n`
  );
  process.stdout.write(`  ability ${s.abilities.map((a) => ABILITIES[a].name).join(', ')}`);
  if (s.hiddenAbility) process.stdout.write(`  (hidden: ${ABILITIES[s.hiddenAbility].name})`);
  process.stdout.write('\n');
  process.stdout.write(`  body    ${s.plan} · ${s.height}m · ${s.weight}kg · ${s.rarity}\n`);
  process.stdout.write(`  catch   rate ${s.catchRate} · exp yield ${s.expYield} · ${s.growthRate} growth\n`);
  process.stdout.write(`  found   ${s.habitat.join(', ') || 'nowhere in particular'}\n\n`);

  process.stdout.write('  evolution line\n');
  for (const entry of evolutionLine(s.id)) {
    const marker = entry.species.id === s.id ? '▶' : ' ';
    process.stdout.write(`   ${marker} ${'  '.repeat(entry.depth)}${entry.species.name}\n`);
  }
  for (const evo of s.evolutions) {
    process.stdout.write(`     → ${DEX[evo.to].name}: ${evo.note}\n`);
  }

  process.stdout.write('\n  learnset\n');
  for (const entry of s.learnset) {
    const move = MOVES[entry.move];
    process.stdout.write(
      `    Lv${String(entry.level).padStart(2)}  ${move.name.padEnd(16)} ${move.type.padEnd(8)} ${move.category.padEnd(8)} ${move.power || '—'}\n`
    );
  }
}
