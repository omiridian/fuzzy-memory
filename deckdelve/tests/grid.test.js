import { assert, equal, group, test } from './harness.js';
import {
  DOOR_PX, ROOM_PX, canPlace, clampToRoom, depthMap, doorPoint, findPath, frontierDoors,
  hasDoor, insideRoom, key, legalCells, opposite, roomBounds, roomCenter, waypointsAlong, worldToGrid,
} from '../src/systems/grid.js';
import { ALL_DOORS, DOOR_E, DOOR_N, DOOR_S, DOOR_W, rotateDoors, rotationCount } from '../src/data/cards.js';

function makeRooms(list) {
  const rooms = new Map();
  for (const [x, y, doors, name] of list) {
    rooms.set(key(x, y), { x, y, doors, name: name || 'Room' });
  }
  return rooms;
}

group('grid: geometry', () => {
  test('room centres and bounds sit where the maths says', () => {
    equal(roomCenter(0, 0).x, ROOM_PX / 2);
    equal(roomCenter(1, -1).y, -ROOM_PX / 2);
    const b = roomBounds(0, 0);
    assert(b.right - b.left === ROOM_PX - 32, 'interior is the room minus both walls');
  });

  test('a doorway is shared by both rooms that own it', () => {
    const mine = doorPoint(0, 0, 2);
    const theirs = doorPoint(0, 1, 0);
    equal(mine.x, theirs.x);
    equal(mine.y, theirs.y);
  });

  test('world coordinates map back to the right cell', () => {
    equal(worldToGrid(10, 10).x, 0);
    equal(worldToGrid(-1, -1).x, -1);
    equal(worldToGrid(ROOM_PX + 5, 0).x, 1);
  });

  test('opposite side is the one you come back through', () => {
    equal(opposite(0), 2);
    equal(opposite(1), 3);
  });
});

group('grid: door masks', () => {
  test('rotation moves doors round the compass', () => {
    equal(rotateDoors(DOOR_N, 1), DOOR_E);
    equal(rotateDoors(DOOR_N, 2), DOOR_S);
    equal(rotateDoors(DOOR_N | DOOR_E, 2), DOOR_S | DOOR_W);
  });

  test('symmetric cards have fewer distinct rotations', () => {
    equal(rotationCount(ALL_DOORS), 1);
    equal(rotationCount(DOOR_N | DOOR_S), 2);
    equal(rotationCount(DOOR_N | DOOR_E), 4);
  });

  test('hasDoor reads the mask by side index', () => {
    assert(hasDoor(DOOR_N | DOOR_W, 0));
    assert(hasDoor(DOOR_N | DOOR_W, 3));
    assert(!hasDoor(DOOR_N | DOOR_W, 1));
  });
});

group('grid: the placement law', () => {
  const rooms = () => makeRooms([[0, 0, ALL_DOORS, 'Entrance']]);

  test('a card with a matching door may be built onto the dungeon', () => {
    equal(canPlace(rooms(), 0, -1, DOOR_N | DOOR_S).ok, true);
  });

  test('a wall facing a door is refused', () => {
    const result = canPlace(rooms(), 0, -1, DOOR_E | DOOR_W);
    equal(result.ok, false);
    assert(result.reason.includes('door'), 'the refusal explains itself');
  });

  test('a door facing a wall is refused', () => {
    const map = makeRooms([[0, 0, DOOR_S, 'Dead End']]);
    equal(canPlace(map, 0, -1, DOOR_S).ok, false);
  });

  test('an occupied cell is refused', () => {
    equal(canPlace(rooms(), 0, 0, ALL_DOORS).ok, false);
  });

  test('a cell touching nothing is refused', () => {
    equal(canPlace(rooms(), 5, 5, ALL_DOORS).ok, false);
  });

  test('rooms may not sprawl past the grid limit', () => {
    equal(canPlace(rooms(), 40, 0, ALL_DOORS).ok, false);
  });

  test('a door facing open space is fine — that is the frontier', () => {
    const map = rooms();
    equal(canPlace(map, 0, -1, ALL_DOORS).ok, true);
    equal(frontierDoors(map).length, 4);
  });

  test('legalCells lists exactly the cells canPlace accepts', () => {
    const map = rooms();
    const cells = legalCells(map, DOOR_N | DOOR_S);
    equal(cells.length, 2);
    for (const cell of cells) equal(canPlace(map, cell.x, cell.y, DOOR_N | DOOR_S).ok, true);
  });
});

group('grid: getting about', () => {
  const corridor = makeRooms([
    [0, 0, ALL_DOORS],
    [0, 1, DOOR_N | DOOR_S],
    [0, 2, DOOR_N | DOOR_E],
    [1, 2, DOOR_W],
    [3, 3, ALL_DOORS],
  ]);

  test('a path follows linked doors only', () => {
    const path = findPath(corridor, { x: 0, y: 0 }, { x: 1, y: 2 });
    equal(path.length, 4);
    equal(path[3].x, 1);
  });

  test('an unconnected room is unreachable', () => {
    equal(findPath(corridor, { x: 0, y: 0 }, { x: 3, y: 3 }), null);
  });

  test('depth counts rooms from the entrance', () => {
    const depth = depthMap(corridor, { x: 0, y: 0 });
    equal(depth.get(key(0, 2)), 2);
    equal(depth.get(key(1, 2)), 3);
    equal(depth.has(key(3, 3)), false);
  });

  test('waypoints alternate room centre and doorway', () => {
    const points = waypointsAlong([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    equal(points.length, 3);
    assert(points[1].door, 'the middle point is the doorway');
    equal(points[1].y, ROOM_PX);
  });
});

group('grid: walls actually stop people', () => {
  test('a body is pushed out of solid masonry', () => {
    const room = { x: 0, y: 0, doors: DOOR_N };
    const fixed = clampToRoom(room, 0, 0, 4, 70, 5);
    assert(fixed.x >= roomBounds(0, 0).left, 'pushed back inside the west wall');
  });

  test('a body may stand in an open doorway', () => {
    const room = { x: 0, y: 0, doors: DOOR_N };
    const fixed = clampToRoom(room, 0, 0, ROOM_PX / 2, 2, 5);
    equal(fixed.y, 2);
  });

  test('a body may not walk through a walled side', () => {
    const room = { x: 0, y: 0, doors: DOOR_S };
    const fixed = clampToRoom(room, 0, 0, ROOM_PX / 2, 2, 5);
    assert(fixed.y > 2, 'the north wall holds');
  });

  test('the doorway is only as wide as the door', () => {
    const room = { x: 0, y: 0, doors: DOOR_N };
    const offCentre = clampToRoom(room, 0, 0, ROOM_PX / 2 + DOOR_PX, 2, 5);
    assert(offCentre.y > 2, 'you cannot cross next to the door');
  });

  test('insideRoom agrees with the bounds', () => {
    assert(insideRoom(0, 0, ROOM_PX / 2, ROOM_PX / 2));
    assert(!insideRoom(0, 0, -20, ROOM_PX / 2));
  });
});
