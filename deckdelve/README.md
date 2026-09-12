# Deckdelve

**Build the dungeon. Then send them in.**

A 2D top-down roguelike that runs in the browser. You are not the hero — you
are the one dealing out room cards, one at a time, while four hired adventurers
walk into whatever you just built and deal with it themselves.

No build step, no dependencies, no image assets. Every room, monster and
adventurer is drawn procedurally from shapes.

> The ledger says forty-one expeditions. The wall says nineteen names. The
> guild considers this a good ratio and would like you to keep it that way.

## Running it

You need [Node](https://nodejs.org) and nothing else.

```bash
node tools/serve.mjs
```

Then open <http://localhost:8080>. `npm start` does the same thing. If port
8080 is taken it will pick the next free one.

From the repository root you can also run `npm run deckdelve`, or serve the
whole repo with `node tools/serve.mjs` and visit `/deckdelve/`.

The game must be served over HTTP — opening `index.html` off the filesystem
will not work, because browsers refuse to load ES modules over `file://`.

Progress is saved in your browser's local storage. The guild, the roster, the
dead and your deck all persist between sessions.

## The loop

```
Draw → Place a room → Watch them go in → Fight → Loot →
Grow the dungeon → Threat rises → Extract, or go one room deeper
```

You hold a hand of **room cards**. Each card is a room with doors on specific
sides. A card can only be built where **every wall it shares with a neighbour
agrees** — door to door, or stone to stone — and at least one of those
agreements is a door, so somebody can actually get in. Rotate the card with
**R** until it fits.

The party explores on its own. Nobody needs telling to open the next door.
What you decide is the shape of the dungeon, the posture of the party, and the
moment to turn round and leave.

## Controls

Orders apply to whoever is selected, or to everybody if nobody is.

### On a desktop

| | |
|---|---|
| `1` – `6` | pick a room card from your hand |
| `R` / `Q` | rotate the held card |
| Left click | build on a highlighted cell · or select an adventurer |
| Right click | rally the selection there · on a monster, focus fire |
| `E` `H` `B` `V` `C` | Explore · Hold · fall Back · Rest · Interact |
| `` ` `` | select the whole party · `Esc` clears the selection |
| `Space` | pause · `Tab` game speed · `F` follow the party |
| `WASD` / arrows | pan · mouse wheel zooms · middle-drag pans |
| `M` | mute · `?` the same list, in game |

### On a phone

| | |
|---|---|
| Tap a card, tap a cell | build the room — legal cells are outlined in green |
| Tap a portrait | select them, and read their traits and gear |
| Press and hold the map | rally there · on a monster, focus fire |
| **Rally** | arms a one-tap rally: press it, then tap where you want them |
| Drag | pan the camera · pinch to zoom · **❚❚** to recentre |
| Tap an order | Explore · Rally · Hold · Back · Rest · Use |
| **❚❚** | pause, speed, sound, recentre, help |

The layout is not a scaled-down desktop. A screen held upright gets its own
arrangement — party across the top, orders and hand across the bottom, the
chronicle over the map — with every target sized for a thumb, and the camera
starts further out so more of the dungeon is in view. Turn the phone sideways
and it switches to the desktop arrangement mid-frame.

## Sound

There is not an audio file in the project either. Every noise is synthesised at
runtime out of oscillators and filtered noise — a sword is a band-passed noise
burst with a square-wave thump under it, a room card landing is a sine drop, a
stone grind and a hiss of dust.

The score is generated as it plays. A step scheduler walks a sixteenth-note grid
and decides bar by bar what each layer does, and the layers are wired to the
run:

- **Threat sets the tempo** and how much is playing. Unnoticed is a drone and a
  limping bass pulse; around *Stirring* a slow modal line starts picking its way
  over the top; at *Roused* something begins keeping time, and it speeds up; at
  *Furious* a sour high shimmer comes in and the drone pulls out of tune.
- **A fight brings the drums up**, and drops them when the room goes quiet.
- **A boss gets a three-note motif** that repeats and closes in.
- **The biome picks the mode.** A Corrupted Necropolis really does put the music
  in Phrygian; Hallowed Ground goes Lydian, an Infernal Forge harmonic minor,
  a Warren pentatonic. Build a different dungeon and it is in a different key.

The title screen and the guild hall have their own pieces. Sound is off until
your first tap — browsers insist — and the **♪** button or `M` turns it off for
good; the choice is saved with the guild.

## Adventurers

Four classes, and a fifth the guild can talk into joining.

| Class | Good at | Bad at |
|---|---|---|
| **Fighter** | holding a doorway against arithmetic | reaching an archer across a lake |
| **Rogue** | traps, locks, scouting, doubling a chest | staying alive if anything looks at them |
| **Mage** | deleting a room of small things | a stiff breeze |
| **Cleric** | keeping everyone standing; hitting undead | killing anything that is already alive |
| **Ranger** *(unlockable)* | finishing the fight before it starts | a scrum |

Abilities fire on their own. There are no spells to click. A cleric mends
whoever is worst off; a fighter cleaves when there is a crowd; a rogue waits
until something is busy with somebody else and then puts a knife in it.

### Traits are not flavour text

Every adventurer carries one or two personality traits, and each one is a real
modifier on the autonomous AI:

- **Greedy** values a chest at more than twice what a careful person does, and
  will walk into the treasure vault alone to get it.
- **Coward** turns round much earlier, and lives much longer.
- **Scholar** goes for the tomes, the dials and the alchemist's bench.
- **Reckless** charges, and dies with a much better story.
- **Loyal** breaks off to stand over a badly hurt friend.
- **Superstitious** would genuinely rather not go in the crypt.
- **Claustrophobic** counts the rooms back to daylight, out loud, constantly.
- **Kleptomaniac** pockets first and identifies later, which is how traps happen.

Survive three expeditions and the guild stops calling you new: you pick up
**Veteran** on your own.

Death is permanent. Whatever gold somebody was carrying stays down there with
them, and their name goes on the wall in the guild hall.

## Rooms, tags and biomes

Rooms carry tags — *Undead, Nature, Arcane, Goblin, Fire, Ancient, Holy,
Treasure*. Put the right rooms next to each other and the dungeon decides they
are one place now, with its own weather, its own residents and its own opinion
of your party:

| Recipe | Becomes |
|---|---|
| Crypt + Crypt + Shrine | **Corrupted Necropolis** — the saint is outvoted; healing is halved |
| Deep Forge + Lava Chamber | **Infernal Forge** — the anvil lights, and it is taking requests |
| Mushroom Cave + Underground Lake | **Fungal Wetlands** — warm, wet, glowing, and the caps turn to watch |
| Underground Lake + Crypt | **Drowned Barrow** — the tombs float open like little boats |
| Three Treasure rooms | **The Glittering Fault** — gold in every wall; some of the seams blink |
| Three Goblin rooms | **The Warren** — they come back, and they know the way |
| Three Arcane rooms | **Arcanum Sanctum** | 
| Two Holy rooms | **Hallowed Ground** — the one biome that is on your side |

…and four more. Biomes only form through **connected doors**, so two crypts on
opposite sides of the map are just two crypts. Clear every room of a biome and
it pays tribute.

## Threat

Threat is the dungeon's attention span, and it only ever goes up. Building
dangerous rooms raises it. Killing things raises it. Taking treasure raises it.
Forming a biome raises it. Standing around raises it, slowly, and faster the
deeper you are.

> Unnoticed → Stirring → Roused → Hunting → Furious

Higher Threat means bigger monsters, more elites, and better loot. Every run is
the same question asked over and over: *one more room, or out through the hole
we came in by?*

Press **Extract** and the party turns for the entrance. Everyone still alive has
to actually get there. If the whole party dies, most of the haul stays with the
bodies.

## What is down there

Eight ordinary monster types, elite versions of all of them, and two things
that are not ordinary:

- **Grumwick, the Mimic King** — a chest at the end of a hall of chests. Only
  one of them is breathing. A level-1 party does not beat him.
- **Cindervex, the Vaultwyrm** — older than the dungeon. Arguably the dungeon is
  a thing that grew on her. Bring levels, bring gear, and bring the deck that
  gets you to her before Threat does.

## The guild

Between runs you are in the Adventurer Guild:

- **Roster** — who goes down, who sits out, who gets the good armour, who gets
  dismissed. Hire replacements; the price goes up as the hall fills.
- **Dungeon Deck** — the heart of the roguelike progression. You choose which
  room cards can appear on an expedition, up to twenty. A deck of corridors and
  shrines is a slow, safe, poor run. A deck of crypts and vaults is a short,
  rich, likely fatal one. Stacking tags on purpose is how you farm biomes.
- **Requisitions** — gold buys more cards, the Ranger class, and standing
  arrangements: a bigger hand, faster draws, scavengers who recover more of a
  lost haul, a training yard that starts recruits at level 3.
- **The Wall** — the names, where they fell, and how deep.

## How it is put together

```
src/
  audio/       synthesis engine, sound bank, generative score, event mapping
  core/        seedable RNG, gesture recogniser, small helpers
  data/        cards, enemies, classes, traits, equipment, biomes, events, names
  systems/     grid, dungeon, deck, threat, combat, ai, expedition, guild, saves
  render/      camera, dungeon view, actors, cards, HUD, primitives
  scenes/      title, guild, expedition, results
  main.js      canvas, input, scene stack
tests/         192 tests, no browser required
tools/         static server, bundler, smoke test, touch test, audio check
```

The split that matters: **nothing in `systems/` knows what a canvas is.** A
whole expedition — placing rooms, adventurer AI, combat, loot, biomes forming,
the party dying — runs headless under Node, which is why the test suite can
simulate ten three-minute expeditions in under a second and assert that nobody
ended up inside a wall.

```bash
npm test          # or: node tests/run.js
npm run bundle    # one self-contained HTML file in dist/
npm run mobile    # drives the bundle with real touch pointers in Chromium
npm run audio     # measures what the game actually plays
npm run sample    # records an excerpt of the score to a .wav
```

`tools/bundle.mjs` flattens the modules into a single inline script — the same
game in one file, for dropping somewhere that serves one file. It refuses to
build if two modules declare the same top-level name rather than letting one
silently shadow the other.

`tools/mobile-check.mjs` plays the bundle at 390×844, 844×390 and 1280×800,
dispatching genuine touch pointers: taps, press-and-hold, drags and a
two-finger pinch. It asserts the things a screenshot cannot — that a tap on a
card picks it up, that press-and-hold issues a rally, that pinching changes the
zoom, that the debrief scrolls, and that the save survives a reload.

`tools/audio-check.mjs` does the same for the ears. The unit tests only prove
the audio layer never crashes without Web Audio; this boots a real browser,
taps an analyser onto the master bus, and measures the peak level every sound
and every piece of music produces. A recipe with a bad envelope is silent, not
broken, and nothing but listening catches that.

## Notes on the design

- **Sight is room-shaped.** Nobody targets through masonry. The one exception is
  a doorway, and it is deliberately tight: both bodies have to be standing *in*
  the gap, close enough that a sword reaches. A wider rule reads as more
  generous and plays as an exploit — an archer shooting something physically
  unable to cross and answer.
- **Monsters guard a room; they do not live in a cage.** They will follow you
  one room from home — two for a boss — and give up after about seven seconds,
  then go back to guarding the thing they were guarding. Without the clock,
  every room the party walks past adds another permanent pursuer and the whole
  dungeon ends up in one corridor behind them.
- **Being shot is being noticed.** Damage makes a monster turn on whoever dealt
  it, whatever its aggro radius says. Outranging something is a tactic; being
  invisible while you do it was a bug.
- **Contents are rolled on entry, not on placement.** What is in a room is
  decided by the Threat at the moment somebody opens the door, so a room you
  built early and visit late is worse than it would have been.
- **One chest, one pair of hands.** Interactables are claimed, so four people
  never converge on the same barrel and shove each other out of it forever.
- **The chronicle is the game's memory.** Most of the humour and all of the
  emergent stories live in that feed: who opened what, who ran, and what it was
  that got them.
- **A tap is not a hover.** A mouse can hover, so on a desktop every control
  explains itself for free. A tap is already an action, so on a phone only a
  deliberate press-and-hold — or a tap on a portrait — opens a panel, because
  anything else leaves it sitting on top of the buttons underneath.
- **Saves stay in the browser.** The runtime offers a shared document store,
  but one store shared by every viewer is the wrong shape here: two people
  opening the same link would fight over one guild and one wall of the dead.
- **The simulation cannot hear itself.** Nothing under `systems/` imports the
  audio layer. It calls `signal(name, data)`, which does nothing at all unless
  something has attached — and a test asserts a run behaves identically either
  way.

## Things that are deliberately not here yet

This is a first prototype, scoped to one dungeon environment. Left for later:
multiple biome *environments* (ice, sewers, the surface ruins), multi-cell room
cards, an equipment crafting loop at the Deep Forge, and adventurer relationships
(the Loyal trait currently likes everyone equally).
