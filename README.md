# Aetherlings

A 2D monster-collecting JRPG that runs in the browser. No build step, no
dependencies, no image assets — every creature is drawn procedurally from its
body plan and elemental palette.

> The Weave is the thing underneath everything. It is what lets a creature
> breathe fire without cooking itself. For four hundred years it has held.
> This spring it started to fray.

## Running it

You need [Node](https://nodejs.org) and nothing else — no `npm install`, no
build step, no dependencies.

```bash
node tools/serve.mjs
```

Then open <http://localhost:8080>. Leave that terminal open while you play;
Ctrl+C stops the server. If port 8080 is taken, pass another:
`node tools/serve.mjs 3000`.

`npm start` does the same thing. On Windows, PowerShell blocks npm's script
wrapper by default (`npm.ps1 cannot be loaded because running scripts is
disabled`) — use `node tools/serve.mjs` and sidestep it entirely, or run
`npm.cmd start`.

The game must be served over HTTP; opening `index.html` straight from the
filesystem will not work, because browsers refuse to load ES modules over
`file://`.

### On a phone

The server prints a second address for any device on the same Wi-Fi — open
that on your phone and it plays there, with an on-screen d-pad that appears
automatically on touch screens. Windows will ask to let Node through the
firewall the first time; allow it for private networks.

To play away from your computer, publish it: the game is a static site, so
GitHub Pages serves it as-is. In the repository's **Settings → Pages**, set
Source to *Deploy from a branch*, pick this branch and the `/ (root)` folder.
A minute later it is live at `https://<user>.github.io/<repo>/`, playable from
anywhere with no server running. Saves live in whichever browser you play in,
so phone and desktop keep separate games.

| Key | Does |
| --- | --- |
| Arrows / WASD | Walk |
| Z / Enter / Space | Talk, confirm |
| X / Escape | Back, cancel |
| M / Tab | Menu (and reorder the party) |
| Shift | Run |

## What is in it

**317 creatures.** Sixteen elemental types, 129 fully evolved forms, 23
branching evolution lines and five legendaries. Evolution triggers include
levels, stones, friendship, the in-game clock (day/night) and stat
comparisons — a Flarehound with more Attack than Sp. Atk becomes a Pyrelord;
the other way round it becomes a Cinderwraith.

The story creatures, starters, Warden aces and legendaries are hand-written in
`src/data/families.js`. The rest of the roster is generated deterministically
in `src/data/speciesgen.js` from per-type name banks, archetype stat spreads
and flavour phrase banks, so the dex is identical on every machine and in
every save file without shipping 300 hand-written records.

**Turn-based battles.** 174 moves and 93 abilities. Physical/special/status
split, stat stages, critical hits, priority, multi-hit moves, drain, recoil,
seven status conditions (including Weave-fray, which stops you healing
properly), volatile conditions, four weathers, entry hazards, screens, held
items, switching, and an AI that scales from "wild animal" to "reads the
matchup and switches".

**Catching and raising.** Classic shake-check capture maths — wear a creature
down, put it to sleep, throw a better orb. Nine orb types with situational
bonuses (Dusk Orbs underground, Net Orbs on Insect and Tide, Timer Orbs late
in a long fight). Creatures carry IVs, training values (EVs), a nature that
shifts two stats, an ability, a held item and a friendship value that gates
some evolutions.

**A world with a story.** Twenty-three maps: four towns, seven routes and
caves, four Warden Halls, shops, waystations, storage terminals and the
Riftmouth. Eight main-story chapters and fifteen side quests, all driven off
game flags so any script, battle or pickup can advance them. Four Warden
trials to earn seals, and the Cinder Compact to argue with — they are not
wrong about the Weave being a resource, which is the problem.

**An economy.** 130 items across nine categories: orbs, medicine, battle
draughts, field aids, vitamins, evolution stones, held items, move tomes and
sell-only treasure. Shops buy and sell, a broker pays for valuables, a smith
trades held gear for scrap, and a woodcutter swaps tomes for herbs.

## Layout

```
index.html            canvas shell
src/
  core/               seeded RNG, small helpers
  data/               types, moves, abilities, natures, items, quests, maps,
                      hand-written families + the species generator
  systems/            creature instances, party, bag, quest log, save file
  battle/             the turn engine and its effect tables
  world/              tiles, map loading, collision, encounter rolls
  render/             procedural sprites, tile painter, UI widgets
  scenes/             title, overworld, battle, menus, story scripts
tests/                the test suite (no dependencies)
tools/                static server, dex dump, browser + layout checks
```

Nothing under `src/data`, `src/systems`, `src/battle` or `src/world` touches
the DOM, which is why the whole game logic runs under Node in the tests.

## Tests

```bash
node tests/run.js      # 137 assertions across data, systems, battles, a playthrough
node tools/dexdump.js  # roster summary; --all, --id <name>, --type ember, --json
node tools/smoke.mjs   # boots the real game in Chromium and plays the opening
node tools/checklayout.mjs  # renders at desktop, laptop and phone sizes
```

The suite covers data integrity (every learnset move exists, every warp lands
somewhere, no NPC is standing inside a wall, the whole world is reachable from
the starting town), the systems (stat maths, exp curves, every evolution
trigger, capture odds, the economy, save round-trips) and the battle engine
(type effectiveness, statuses, weather, screens, hazards, abilities, held
items, switching, fleeing, catching). It finishes with an integration pass
that fights every trainer in the game, rolls every encounter table, walks the
main quest chain end to end and soaks 500 wild battles looking for illegal
state.

`tools/smoke.mjs` needs Playwright and Chromium. It drives the real game in a
browser — new game, starter choice, menus, a wild battle, a trainer battle, a
shop, save and reload — fails on any console error, and drops screenshots in
`screenshots/`.

## Saves

Saves live in `localStorage` under `aetherlings.save.v1` and hold the party,
storage boxes, bag, money, flags, quest state, dex records and position. The
title screen offers Continue when one exists.

---

## Also in this repository: Deckdelve

[`deckdelve/`](deckdelve/) is a separate game that shares the repo and nothing
else — a 2D top-down roguelike where you build the dungeon out of room cards
while a party of autonomous adventurers explores it in real time.

It plays with a mouse and keyboard on a desktop, and with touch on a phone —
tap to build, press-and-hold to give orders, pinch to zoom — with a layout that
rearranges itself for a screen held upright. Sound and music are synthesised at
runtime; there is no audio file in it either.

```bash
npm run deckdelve          # serves it on http://localhost:8080
npm run test:deckdelve     # its own suite, 180 tests
```

`npm test` at the root now runs both suites. See
[`deckdelve/README.md`](deckdelve/README.md) for the rules, the controls and
how it is put together.
