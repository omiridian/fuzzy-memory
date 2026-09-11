// Names and voices. The guild roster is where most of the stories start, so it
// helps if everyone sounds like somebody in particular.

export const FIRST_NAMES = [
  'Bram', 'Orla', 'Ketch', 'Wenna', 'Dorrin', 'Sable', 'Tib', 'Hollis', 'Marn', 'Ysolde',
  'Pike', 'Gran', 'Ferrin', 'Colm', 'Nettle', 'Osric', 'Bryn', 'Halvard', 'Wick', 'Perrin',
  'Ash', 'Mabel', 'Corwin', 'Greta', 'Lark', 'Dunn', 'Ivo', 'Seren', 'Rook', 'Talia',
  'Crane', 'Fen', 'Aldous', 'Peg', 'Vance', 'Isolde', 'Bodger', 'Quill', 'Maret', 'Tobin',
];

export const EPITHETS = [
  'the Unlucky', 'Threepence', 'of the Low Road', 'Ironhand', 'the Patient', 'Two-Coats',
  'the Younger', 'Quickfingers', 'Longwalk', 'the Reasonable', 'Shortstraw', 'the Undrowned',
  'of Nettlebridge', 'Cask', 'the Louder', 'Wetboot', 'Nine-Lives', 'the Unpaid',
  'Halfmast', 'the Sensible', 'Coldiron', 'Backwards', 'the Third', 'Nobody',
];

export const HIRE_LINES = [
  'Claims to have survived a collapse. Has the limp to prove something.',
  'Owes money to three guilds and one temple.',
  'Reads. Out loud. Constantly. Usually the wrong things.',
  'Has a sword that is definitely somebody else’s.',
  'Very good in a crisis, entirely useless outside one.',
  'Was a baker. Says the hours are better down here.',
  'Talks to the dungeon. Insists it started it.',
  'Retired once. It did not take.',
];

/** Things adventurers say. Keyed by the situation the AI is in. */
export const BARKS = {
  enter_room: [
    'Well. It has a floor.',
    'Nobody touch anything yet.',
    'I do not like the shape of this one.',
    'Smells like money. Or the other thing.',
    'Mark the door. Mark it properly this time.',
  ],
  loot: [
    'Right. That is the mortgage.',
    'Split four ways. Four. Ways.',
    'I am carrying this one.',
    'Do not tell the guild about this bit.',
  ],
  fight: [
    'Left! LEFT!',
    'Hold the door!',
    'It is fine. It is fine. It is not fine.',
    'Who opened that?',
  ],
  hurt: [
    'That is a lot of my blood.',
    'I am walking it off. I am not walking it off.',
    'Somebody do something clerical!',
  ],
  flee: [
    'Strategic! It is strategic!',
    'Back. Back back back.',
    'We are leaving. I have decided this democratically, alone.',
  ],
  rest: [
    'Five minutes. Five actual minutes.',
    'Anyone else’s hands doing this?',
    'I am counting the exits again.',
  ],
  death: [
    'Tell the guild it was bigger than it was.',
    'Take the boots. Good boots.',
    'Ah.',
    'I knew about the third step. I knew.',
  ],
  extract: [
    'Daylight. Actual daylight.',
    'Never again. Until next week.',
    'Count it. Count it twice.',
  ],
};

export const OBITUARIES = [
  'fell in {room}, {depth} rooms deep, with {gold} gold in their pack.',
  'was last seen holding the doorway of {room}. The doorway held.',
  'did not come back out of {room}. Nobody will say what did.',
  'ended {depth} rooms down, in {room}, doing something brave and inadvisable.',
];
