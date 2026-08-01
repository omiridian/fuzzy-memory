// Scripted NPC interactions: the story beats, the Warden trials, the service
// counters. Each script receives the overworld scene and the NPC that was
// spoken to.

import { STARTER_IDS, getSpecies } from '../data/species.js';
import { getItem } from '../data/items.js';
import { createMon } from '../systems/monster.js';
import { rngFromString } from '../core/rng.js';
import { formatMoney } from '../core/util.js';

const SCRIPTS = {};

function script(id, fn) {
  SCRIPTS[id] = fn;
}

export function runScript(scene, id, npc) {
  const fn = SCRIPTS[id];
  if (!fn) {
    scene.say(npc.dialogue || ['...']);
    return;
  }
  fn(scene, npc, scene.game, scene.app);
}

export function hasScript(id) {
  return !!SCRIPTS[id];
}

// ── Chapter 1: the laboratory ──────────────────────────────────────────────
script('aldrin_intro', (scene, npc, game) => {
  if (!game.getFlag('met_aldrin')) {
    game.setFlag('met_aldrin');
    game.quests.start('ch1_first_light');
    scene.say([
      { speaker: 'Prof. Aldrin', text: `There you are. Sit down — no, don't, there's nowhere to sit.` },
      { speaker: 'Prof. Aldrin', text: 'The Weave is the thing underneath everything. It is what lets a creature breathe fire without cooking itself.' },
      { speaker: 'Prof. Aldrin', text: 'For four hundred years it has held. This spring it started to fray, and I would very much like to know why.' },
      { speaker: 'Prof. Aldrin', text: 'So: take a Ledger, take a partner from that case, and go and look at the world for me.' },
    ], () => {
      game.bag.add('dex', 1);
      game.bag.add('orb', 5);
      scene.say('You received the Weave Ledger and five Weave Orbs!');
    });
    return;
  }
  if (!game.getFlag('chose_starter')) {
    scene.say([{ speaker: 'Prof. Aldrin', text: 'The case is right there. Pick one. They have all been waiting.' }]);
    return;
  }
  if (game.getFlag('rift_closed')) {
    scene.say([
      { speaker: 'Prof. Aldrin', text: 'The tear is closed and the Weave is knitting. Slowly. Badly, in places.' },
      { speaker: 'Prof. Aldrin', text: 'Something old woke up in the Heartwood while we were busy. If you find the way in, be polite.' },
    ]);
    return;
  }
  scene.say([
    { speaker: 'Prof. Aldrin', text: `${game.caughtCount()} species recorded. Keep at it — the Ledger is the only honest map of this we have.` },
  ]);
});

script('starter_case', (scene, npc, game, app) => {
  if (game.getFlag('chose_starter')) {
    scene.say('The case is empty now. Two of them went to other hands.');
    return;
  }
  if (!game.getFlag('met_aldrin')) {
    scene.say('The case is latched. You should speak to the Professor first.');
    return;
  }
  const options = STARTER_IDS.map((id) => {
    const species = getSpecies(id);
    return { label: `${species.name}  (${species.types.join('/')})`, value: id, detail: species.dex };
  });
  app.pushChoice({
    title: 'Three of them, blinking up at you.',
    options,
    onSelect: (choice) => {
      const mon = createMon(choice.value, 5, { rng: game.rng, friendship: 90 });
      mon.originalTrainer = game.playerName;
      game.receiveMon(mon);
      game.starter = choice.value;
      game.setFlag('chose_starter');
      game.quests.start('side_first_catch');
      scene.say([
        `${getSpecies(choice.value).name} climbs out of the case and looks you over.`,
        'It has decided about you. You will find out what it decided later.',
      ]);
    },
    onCancel: () => scene.say('Take your time. They are patient.'),
  });
});

// ── Services ───────────────────────────────────────────────────────────────
script('nickname_service', (scene, npc, game, app) => {
  if (!game.party.length) {
    scene.say('Come back when you have something to name.');
    return;
  }
  app.pushPartyPicker({
    title: 'Which one shall I name?',
    onSelect: (mon) => {
      const name = app.prompt(`A name for ${getSpecies(mon.species).name}?`, mon.nickname || '');
      if (name && name.trim()) {
        mon.nickname = name.trim().slice(0, 12);
        scene.say(`It will answer to ${mon.nickname} from now on. Mostly.`);
      } else if (name === '') {
        mon.nickname = null;
        scene.say('Back to its given name, then.');
      }
    },
  });
});

script('tome_trader', (scene, npc, game, app) => {
  const herbs = game.bag.count('herb');
  if (herbs < 10) {
    scene.say(`Ten bitter herbs, one tome. You have ${herbs}.`);
    return;
  }
  const stock = ['tome_megadrain', 'tome_aircutter', 'tome_crunch', 'tome_ironhead', 'tome_toxify', 'tome_willowisp'];
  app.pushChoice({
    title: 'Ten herbs. Which tome?',
    options: stock.map((id) => ({ label: getItem(id).name, value: id })),
    onSelect: (choice) => {
      game.bag.remove('herb', 10);
      game.bag.add(choice.value, 1);
      game.setFlag('herb_trade');
      scene.say(`Done. One ${getItem(choice.value).name}, honestly earned.`);
    },
  });
});

script('treasure_broker', (scene, npc, game, app) => {
  const treasures = game.bag.pocket('treasure');
  if (!treasures.length) {
    scene.say('Nothing shiny on you. Come back when there is.');
    return;
  }
  app.pushChoice({
    title: 'What are you selling?',
    options: treasures.map((id) => ({
      label: `${getItem(id).name} x${game.bag.count(id)}`,
      value: id,
      right: `${formatMoney(getItem(id).sell)} ea.`,
    })),
    onSelect: (choice) => {
      const value = game.bag.sell(choice.value, game.bag.count(choice.value));
      scene.say(`Sold. ${formatMoney(value)} shards.`);
    },
  });
});

script('move_relearner', (scene, npc, game, app) => {
  if (game.bag.money < 1000) {
    scene.say('A thousand shards a lesson. You are short.');
    return;
  }
  app.pushPartyPicker({
    title: 'Who needs reminding?',
    onSelect: (mon) => {
      const species = getSpecies(mon.species);
      const known = new Set(mon.moves.map((m) => m.id));
      const options = species.learnset
        .filter((entry) => entry.level <= mon.level && !known.has(entry.move))
        .map((entry) => entry.move);
      if (!options.length) {
        scene.say('It remembers everything it ever knew. Impressive, honestly.');
        return;
      }
      app.pushMoveLearner(mon, options[options.length - 1], {
        cost: 1000,
        onDone: (learned) => {
          if (learned) game.bag.spend(1000);
        },
      });
    },
  });
});

script('vitamin_seller', (scene, npc, game, app) => {
  app.push(app.makeShopScene(['hpup', 'protein', 'iron', 'calcium', 'zinc', 'carbos']));
});

script('forge_smith', (scene, npc, game, app) => {
  const scrap = game.bag.count('scrap');
  if (scrap < 5) {
    scene.say(`Five pieces of scrap and I will make you something. You have ${scrap}.`);
    return;
  }
  const stock = ['focussash', 'quickclaw', 'leftovers', 'assaultvest', 'eviolite'];
  app.pushChoice({
    title: 'Five scrap. What am I making?',
    options: stock.map((id) => ({ label: getItem(id).name, value: id })),
    onSelect: (choice) => {
      game.bag.remove('scrap', 5);
      game.bag.add(choice.value, 1);
      game.setFlag('smith_trade');
      scene.say(`There. One ${getItem(choice.value).name}. Do not lose it.`);
    },
  });
});

// ── Warden trials ──────────────────────────────────────────────────────────
function wardenScript(id, config) {
  script(id, (scene, npc, game, app) => {
    if (game.getFlag(config.sealFlag)) {
      scene.say(config.afterLines);
      return;
    }
    scene.say(config.introLines, () => {
      app.startBattle({
        trainerNpc: npc,
        trainer: {
          name: config.name,
          title: 'Warden',
          prize: config.prize,
          ai: 4,
          items: config.items || ['hyperpotion'],
          team: config.team,
          dialogue: config.dialogue,
        },
        isWild: false,
        onVictory: () => {
          game.setFlag(config.sealFlag);
          game.badges.push(config.seal);
          game.bag.add('warden_seal', 1);
          scene.say([
            config.victoryLine,
            `You received the ${config.sealName}!`,
          ], () => {
            if (config.gift) {
              game.bag.add(config.gift.item, config.gift.qty);
              scene.say(`${config.name} also handed you ${config.gift.qty}x ${getItem(config.gift.item).name}.`);
            }
            const seals = ['seal_verdant', 'seal_tide', 'seal_volt', 'seal_ember'];
            if (seals.every((f) => game.getFlag(f))) game.setFlag('all_seals');
          });
        },
      });
    });
  });
}

wardenScript('warden_verdant', {
  name: 'Warden Ilse',
  seal: 'verdant',
  sealName: 'Grove Seal',
  sealFlag: 'seal_verdant',
  prize: 2400,
  introLines: [
    { speaker: 'Warden Ilse', text: 'You came through the wood. You will have seen the grey patches.' },
    { speaker: 'Warden Ilse', text: 'The Compact calls it harvesting. A wood does not grow back from harvesting like that.' },
    { speaker: 'Warden Ilse', text: 'A trial, then. Show me you can hold a line, and I will give you a seal that opens doors.' },
  ],
  team: [
    { habitat: 'forest', level: 14 },
    { habitat: 'grass_early', level: 15 },
    { species: 'thornward', level: 17 },
  ],
  dialogue: {
    intro: 'Roots first. Everything else after.',
    defeat: 'Good. You do not panic. That matters more than power.',
  },
  victoryLine: 'Warden Ilse presses a knot of green wood into your hand.',
  gift: { item: 'tome_megadrain', qty: 1 },
});

wardenScript('warden_tide', {
  name: 'Warden Maris',
  seal: 'tide',
  sealName: 'Harbour Seal',
  sealFlag: 'seal_tide',
  prize: 3600,
  introLines: [
    { speaker: 'Warden Maris', text: 'Freighters dock at my harbour at three in the morning and nobody signs for them.' },
    { speaker: 'Warden Maris', text: 'I would go myself. I am the only thing keeping this city from being bought outright.' },
    { speaker: 'Warden Maris', text: 'Beat me and I will consider you worth sending. Go on.' },
  ],
  team: [
    { habitat: 'coast', level: 20 },
    { habitat: 'harbor', level: 21 },
    { species: 'brookend', level: 23 },
  ],
  dialogue: {
    intro: 'The tide does not hurry and it does not stop.',
    defeat: 'All right. You will do. Go and look at that warehouse.',
  },
  victoryLine: 'Warden Maris hands over a seal cut from tidewood.',
  gift: { item: 'ultraorb', qty: 3 },
});

wardenScript('warden_volt', {
  name: 'Warden Kessa',
  seal: 'volt',
  sealName: 'Ridge Seal',
  sealFlag: 'seal_volt',
  prize: 5000,
  introLines: [
    { speaker: 'Warden Kessa', text: 'They offered me money for the ridge. An enormous amount. I laughed until I had to sit down.' },
    { speaker: 'Warden Kessa', text: 'Now they come at night with cutting gear. Same people. Better manners at the time.' },
    { speaker: 'Warden Kessa', text: 'Fight me properly. I want to see what the Wardens are betting on.' },
  ],
  team: [
    { habitat: 'stormcoast', level: 27 },
    { habitat: 'facility', level: 28 },
    { species: 'arcmane', level: 30 },
  ],
  dialogue: {
    intro: "Storm's already here. You just walked into it.",
    defeat: 'Hah! Good. Very good.',
  },
  victoryLine: 'Warden Kessa snaps a seal off her own coat and gives it to you.',
  gift: { item: 'storm_shard', qty: 1 },
});

wardenScript('warden_ember', {
  name: 'Warden Bruhn',
  seal: 'ember',
  sealName: 'Vent Seal',
  sealFlag: 'seal_ember',
  prize: 7000,
  introLines: [
    { speaker: 'Warden Bruhn', text: 'I went down into the vent works twice. The second time I did not go far.' },
    { speaker: 'Warden Bruhn', text: 'They have opened something. Not a mine. A hole in the underneath.' },
    { speaker: 'Warden Bruhn', text: 'If you are going after it you will need a seal and you will need to earn it. Now.' },
  ],
  team: [
    { habitat: 'volcano', level: 34 },
    { habitat: 'forge', level: 35 },
    { species: 'bellowbeast', level: 37 },
  ],
  dialogue: {
    intro: 'Everything in here has already burned once.',
    defeat: 'Then it falls to you. I am sorry about that.',
  },
  victoryLine: 'Warden Bruhn gives you a seal of blackened iron, still warm.',
  gift: { item: 'flame_shard', qty: 1 },
});

// ── The Compact ────────────────────────────────────────────────────────────
script('harbor_guard', (scene, npc, game, app) => {
  if (game.getFlag('entered_warehouse')) {
    scene.say('Go on in. It is not as if I can stop you twice.');
    return;
  }
  if (!game.getFlag('seal_tide')) {
    scene.say([
      { speaker: 'Compact Hand', text: 'Private dock. Warden business only, and you are not a Warden.' },
    ]);
    return;
  }
  scene.say([
    { speaker: 'Compact Hand', text: 'A Warden Seal. Lovely. It does not open doors here.' },
    { speaker: 'Compact Hand', text: 'It opens this one, unfortunately, if you can get past me.' },
  ], () => {
    app.startBattle({
      trainerNpc: npc,
      trainer: {
        name: 'Compact Hand Ovar',
        title: 'Cinder Compact',
        prize: 1800,
        ai: 4,
        team: [
          { species: 'cinderrat', level: 22 },
          { habitat: 'facility', level: 23 },
          { species: 'coilhound', level: 24 },
        ],
        dialogue: { intro: 'On your head be it.', defeat: 'Fine. Fine! Look at it. See how you sleep after.' },
      },
      isWild: false,
      onVictory: () => {
        game.setFlag('entered_warehouse');
        npc.dir = 'right';
        scene.say('The guard steps aside. The warehouse door is open.');
      },
    });
  });
});

script('siphon_confrontation', (scene, npc, game, app) => {
  if (game.getFlag('got_schematics')) {
    scene.say('The siphon sits dead in its cradle. It still hums, faintly, as if remembering.');
    return;
  }
  scene.say([
    { speaker: '???', text: 'You are early. Or I am slow. Either way — welcome to the Weave, properly.' },
    { speaker: 'Hollis Cray', text: 'It is not magic and it is not sacred. It is a resource, and it is enormous, and it is going to waste.' },
    { speaker: 'Hollis Cray', text: 'Everyone who has ever said "some things should not be touched" was standing on top of something they had already touched.' },
    { speaker: 'Hollis Cray', text: 'Show me your objection, then. Properly.' },
  ], () => {
    app.startBattle({
      trainerNpc: npc,
      trainer: {
        name: 'Hollis Cray',
        title: 'Compact Director',
        prize: 4000,
        ai: 4,
        items: ['hyperpotion', 'hyperpotion'],
        team: [
          { species: 'ashstalker', level: 24 },
          { species: 'dynamaw', level: 25 },
          { species: 'snarlweave', level: 26 },
        ],
        dialogue: {
          intro: 'I have read further than your Wardens. Do keep up.',
          defeat: 'Hm. Noted. Genuinely.',
        },
      },
      isWild: false,
      onVictory: () => {
        game.setFlag('got_schematics');
        game.bag.add('siphon_plans', 1);
        scene.say([
          'Hollis Cray steps back from the siphon and leaves the schematics on the bench.',
          { speaker: 'Hollis Cray', text: 'Take them. Read them. You will find there is no lie in them anywhere.' },
          { speaker: 'Hollis Cray', text: 'That is the part people find hardest.' },
          'You obtained the Siphon Schematics!',
        ]);
      },
    });
  });
});

script('archive_scholar', (scene, npc, game) => {
  if (!game.getFlag('talked_nedd')) {
    game.setFlag('talked_nedd');
    game.quests.start('ch6_archive');
  }
  scene.say([
    { speaker: 'Archivist Nedd', text: 'The first Wardens did not build the Weave. They found it fraying and they tied it off.' },
    { speaker: 'Archivist Nedd', text: 'Four knots. Four seals. That is all the Warden system has ever been: maintenance.' },
    { speaker: 'Archivist Nedd', text: 'Cray read the same page I did. He simply reached a different conclusion about what you do with a knot.' },
    { speaker: 'Archivist Nedd', text: 'You untie it, apparently, and take what falls out.' },
  ]);
});

script('final_confrontation', (scene, npc, game, app) => {
  if (game.getFlag('rift_closed')) {
    scene.say([
      'The tear is a seam now, pale and closed.',
      'Something on the far side is still awake. It is not in a hurry.',
    ]);
    return;
  }
  if (!game.getFlag('all_seals')) {
    scene.say([
      'The tear churns. Getting closer would take four Warden Seals and more nerve than sense.',
    ]);
    return;
  }
  scene.say([
    { speaker: 'Hollis Cray', text: 'You brought the seals. Good. I could not have opened it this wide without knowing where the knots were.' },
    { speaker: 'Hollis Cray', text: 'Look at it. Every creature that ever did something impossible drew on this. And it was just sitting here.' },
    { speaker: 'Hollis Cray', text: 'I am not going to tell you I was right. I am going to show you, and you are going to have to decide.' },
  ], () => {
    app.startBattle({
      trainerNpc: npc,
      trainer: {
        name: 'Hollis Cray',
        title: 'Compact Director',
        prize: 12000,
        ai: 4,
        items: ['fullrestore', 'fullrestore'],
        team: [
          { species: 'ashstalker', level: 46 },
          { species: 'dynamaw', level: 47 },
          { species: 'crucibrand', level: 48 },
          { species: 'snarlweave', level: 48 },
          { species: 'nullhymn', level: 50 },
        ],
        dialogue: {
          intro: 'Everything I have, then. You have earned that much.',
          defeat: 'Oh. Oh, that is — that is not what I expected to feel.',
        },
      },
      isWild: false,
      onVictory: () => {
        game.setFlag('defeated_hollis');
        scene.say([
          { speaker: 'Hollis Cray', text: 'It is still open. I cannot close it. I never worked out that part.' },
          'You hold up the Riftglass. The tear runs through it like a thread through a needle.',
          'The four seals warm in your bag, one after another, and something enormous underneath the world takes hold of the loose end.',
        ], () => {
          game.setFlag('rift_closed');
          game.bag.add('masterorb', 1);
          game.bag.add('heartwood_key', 1);
          scene.say([
            'The tear closes with a sound like a held breath let go.',
            { speaker: 'Hollis Cray', text: 'I would do it again, you know. Better. That is the honest answer.' },
            { speaker: 'Hollis Cray', text: 'Take these. A Sovereign Orb, and a key I have no use for now. The Heartwood gate answers to it.' },
            'You received the Sovereign Orb and the Heartwood Key!',
          ]);
        });
      },
    });
  });
});

// ── Legendaries ────────────────────────────────────────────────────────────
script('legendary_sylvara', (scene, npc, game, app) => {
  if (game.getFlag('caught_sylvara')) {
    scene.say('The clearing is quiet. The roots have gone back to whatever roots do.');
    return;
  }
  if (game.getFlag('met_sylvara') && game.getFlag('sylvara_fled')) {
    scene.say('It is here again, watching. It will not run twice.');
  }
  game.setFlag('met_sylvara');
  scene.say([
    'The clearing is older than the wood around it.',
    'Something uncurls from the roots — enormous, unhurried, entirely aware of you.',
    { speaker: 'Sylvara', text: '...' },
  ], () => {
    const mon = createMon('sylvara', 55, { rng: rngFromString('legend:sylvara'), friendship: 0 });
    game.recordSeen('sylvara');
    app.startBattle({
      foeParty: [mon],
      isWild: true,
      canFlee: false,
      legendary: 'sylvara',
      environment: 'grass',
    });
  });
});

export { SCRIPTS };
