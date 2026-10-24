import { CELL, GRID_W as W, GRID_H as H } from '../game/constants.js';
import { mulberry32 } from '../utils/rng.js';

/** Tiny map builder: everything starts as WALL, then rooms / corridors / doors / exits are carved out. */
function createMap() {
  const cells = new Uint8Array(W * H);
  const m = { cells, rooms: [], corridors: [], blocked: [], fires: [], trees: [] };
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, t) => { if (inb(x, y)) cells[y * W + x] = t; };
  const get = (x, y) => (inb(x, y) ? cells[y * W + x] : CELL.WALL);
  const fill = (x1, y1, x2, y2, t) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(x, y, t); };
  const rect = (name, x1, y1, x2, y2) => ({ name, x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 });
  Object.assign(m, {
    get,
    room(name, x1, y1, x2, y2) { fill(x1, y1, x2, y2, CELL.ROOM); m.rooms.push(rect(name, x1, y1, x2, y2)); },
    corridor(name, x1, y1, x2, y2, t = CELL.CORRIDOR) { fill(x1, y1, x2, y2, t); m.corridors.push(rect(name, x1, y1, x2, y2)); },
    door(x1, y1, x2 = x1, y2 = y1) { fill(x1, y1, x2, y2, CELL.DOOR); },
    exit(x, y) { set(x, y, CELL.EXIT); },
    block(x1, y1, x2, y2) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) m.blocked.push({ x, y }); },
    fire(x, y) { m.fires.push({ x, y }); },
    /** Building shell: walls on the border, room inside, doors punched through. */
    building(name, x1, y1, x2, y2, doors) {
      fill(x1, y1, x2, y2, CELL.WALL); fill(x1 + 1, y1 + 1, x2 - 1, y2 - 1, CELL.ROOM);
      m.rooms.push(rect(name, x1 + 1, y1 + 1, x2 - 1, y2 - 1));
      doors.forEach(([x, y]) => set(x, y, CELL.DOOR));
    },
    obstacles(list) {
      for (const [x, y] of list) { const t = get(x, y); if (t === CELL.ROOM || t === CELL.CORRIDOR || t === CELL.OUTDOOR) { if (t === CELL.OUTDOOR) m.trees.push(y * W + x); set(x, y, CELL.OBSTACLE); } }
    },
    /** Rows of 2-wide desks inside a rect, never next to a door. */
    desks(x1, y1, x2, y2, stepX, stepY, ox = 1, oy = 1) {
      for (let y = y1 + oy; y <= y2 - 1; y += stepY)
        for (let x = x1 + ox; x <= x2 - 2; x += stepX)
          for (const [dx, dy] of [[0, 0], [1, 0]]) {
            let nearDoor = false;
            for (let ay = -2; ay <= 2; ay++) for (let ax = -2; ax <= 2; ax++) if (get(x + dx + ax, y + dy + ay) === CELL.DOOR) nearDoor = true;
            if (!nearDoor && get(x + dx, y + dy) === CELL.ROOM) set(x + dx, y + dy, CELL.OBSTACLE);
          }
    }
  });
  return m;
}

/* ───────────────────────── LEVEL 1 — TRAINING FACILITY ───────────────────────── */
function buildTraining() {
  const m = createMap();
  m.corridor('Main Corridor', 2, 13, 45, 16);
  m.room('Lab A', 3, 3, 16, 11); m.room('Lab B', 31, 3, 44, 11);
  m.room('Storage', 3, 18, 16, 27); m.room('Classroom', 31, 18, 44, 27);
  m.door(8, 12, 9, 12); m.door(37, 12, 38, 12); m.door(8, 17, 9, 17); m.door(37, 17, 38, 17);
  m.corridor('Exit Hall', 22, 17, 25, 28);
  m.exit(1, 14); m.exit(23, 29);
  m.obstacles([[5, 5], [6, 5], [12, 5], [13, 5], [5, 9], [6, 9], [12, 9], [13, 9], [34, 5], [35, 5], [41, 5], [42, 5], [34, 9], [41, 9],
    [6, 21], [7, 21], [12, 24], [13, 24], [34, 21], [35, 21], [41, 21], [42, 21], [34, 25], [35, 25], [41, 25]]);
  m.fire(37, 23);
  return m;
}

/* ───────────────────────── LEVEL 2 — OFFICE BUILDING ───────────────────────── */
function buildOffice() {
  const m = createMap();
  m.room('Office 1', 2, 2, 10, 10); m.room('Office 2', 13, 2, 22, 10); m.room('Office 3', 25, 2, 34, 10); m.room('Office 4', 37, 2, 45, 10);
  m.corridor('Hallway', 2, 12, 45, 15);
  m.room('Open Plan', 2, 17, 14, 27); m.room('Conference', 17, 17, 30, 27); m.room('Server Room', 33, 17, 45, 27);
  m.door(6, 11); m.door(17, 11, 18, 11); m.door(29, 11, 30, 11); m.door(41, 11);
  m.door(7, 16); m.door(23, 16, 24, 16); m.door(39, 16);
  m.exit(1, 13); m.exit(46, 14); m.exit(23, 28);
  m.desks(2, 2, 10, 10, 4, 3); m.desks(13, 2, 22, 10, 4, 3); m.desks(25, 2, 34, 10, 4, 3); m.desks(37, 2, 45, 10, 4, 3);
  m.desks(2, 17, 14, 27, 4, 3); m.desks(33, 17, 45, 27, 4, 3);
  m.obstacles([[21, 21], [22, 21], [23, 21], [24, 21], [25, 21], [26, 21], [21, 23], [22, 23], [25, 23], [26, 23]]);
  m.fire(18, 5); m.fire(39, 23);
  return m;
}

/* ───────────────────────── LEVEL 3 — SHOPPING MALL ───────────────────────── */
function buildMall() {
  const m = createMap();
  m.corridor('Main Hall', 2, 10, 45, 19);
  m.room('Shop 1', 2, 2, 10, 8); m.room('Shop 2', 12, 2, 19, 8); m.room('Shop 3', 28, 2, 35, 8); m.room('Shop 4', 37, 2, 45, 8);
  m.corridor('North Atrium', 21, 2, 26, 9);
  m.room('Shop 5', 2, 21, 10, 27); m.room('Shop 6', 12, 21, 19, 27); m.room('Shop 7', 28, 21, 35, 27); m.room('Shop 8', 37, 21, 45, 27);
  m.corridor('South Atrium', 21, 20, 26, 28);
  m.door(6, 9); m.door(15, 9, 16, 9); m.door(31, 9, 32, 9); m.door(41, 9);
  m.door(6, 20); m.door(15, 20, 16, 20); m.door(31, 20, 32, 20); m.door(41, 20);
  m.exit(1, 14); m.exit(46, 15); m.exit(23, 1); m.exit(23, 29);
  m.obstacles([[8, 14], [9, 14], [8, 15], [9, 15], [18, 12], [19, 12], [18, 17], [19, 17], [28, 14], [29, 14], [28, 15], [29, 15], [38, 12], [39, 12], [38, 17], [39, 17]]);
  m.desks(2, 2, 10, 8, 4, 3); m.desks(12, 2, 19, 8, 4, 3); m.desks(28, 2, 35, 8, 4, 3); m.desks(37, 2, 45, 8, 4, 3);
  m.desks(2, 21, 10, 27, 4, 3); m.desks(12, 21, 19, 27, 4, 3); m.desks(28, 21, 35, 27, 4, 3); m.desks(37, 21, 45, 27, 4, 3);
  // Pre-blocked corridors (partial barricades — there is always a gap)
  m.block(14, 10, 14, 16); m.block(33, 13, 33, 19); m.block(21, 24, 23, 24); m.block(24, 5, 26, 5);
  m.fire(5, 24); m.fire(30, 14); m.fire(31, 5);
  return m;
}

/* ───────────────────────── LEVEL 4 — UNIVERSITY CAMPUS ───────────────────────── */
function buildCampus() {
  const m = createMap();
  m.corridor('Quad', 1, 1, 46, 28, CELL.OUTDOOR);
  m.building('Admin Block', 3, 3, 14, 12, [[8, 12], [14, 8]]);
  m.building('Library', 18, 3, 30, 12, [[24, 12], [18, 8]]);
  m.building('Science Lab', 34, 3, 45, 12, [[39, 12], [34, 8]]);
  m.building('Hostel', 3, 17, 15, 26, [[9, 17], [15, 22]]);
  m.building('Auditorium', 19, 17, 29, 26, [[24, 17], [19, 22], [29, 22]]);
  m.building('Cafeteria', 33, 17, 45, 26, [[39, 17], [33, 22]]);
  m.exit(0, 14); m.exit(47, 14); m.exit(23, 0); m.exit(23, 29);
  // Trees / planters scattered on the quad, kept clear of doors and exits
  const rng = mulberry32(404);
  const nearKey = (x, y) => {
    for (let ay = -2; ay <= 2; ay++) for (let ax = -2; ax <= 2; ax++) { const t = m.get(x + ax, y + ay); if (t === CELL.DOOR || t === CELL.EXIT) return true; }
    return false;
  };
  const trees = [];
  for (let y = 1; y < 29; y++) for (let x = 1; x < 47; x++) if (m.get(x, y) === CELL.OUTDOOR && !nearKey(x, y) && rng() < 0.085) trees.push([x, y]);
  m.obstacles(trees);
  m.desks(4, 4, 13, 11, 4, 3); m.desks(19, 4, 29, 11, 3, 3); m.desks(35, 4, 44, 11, 4, 3);
  m.desks(4, 18, 14, 25, 4, 3); m.desks(20, 18, 28, 25, 3, 3); m.desks(34, 18, 44, 25, 4, 3);
  m.fire(6, 6); m.fire(26, 6); m.fire(40, 21); m.fire(10, 22);
  return m;
}

export const LEVELS = [
  { id: 'training', index: 1, name: 'TRAINING FACILITY', title: 'Training Facility', difficulty: 'EASY', people: 10, fires: 1, exits: 2, time: 120,
    obstacles: 'Low', blockedCorridors: 0, fireSpread: 0.07, reaction: 4, spawnClearance: 7, exitCapacity: 3, suppression: 8, seed: 11, spawnTypes: [CELL.ROOM],
    blurb: 'Learn the controls. Two rooms, a corridor and two exits.', build: buildTraining },
  { id: 'office', index: 2, name: 'OFFICE BUILDING', title: 'Office Building', difficulty: 'MEDIUM', people: 25, fires: 2, exits: 3, time: 100,
    obstacles: 'Medium', blockedCorridors: 0, fireSpread: 0.095, reaction: 6, spawnClearance: 4, exitCapacity: 2.2, suppression: 8, seed: 23, spawnTypes: [CELL.ROOM],
    blurb: 'Seven offices off a central hallway, desks everywhere, two fires.', build: buildOffice },
  { id: 'mall', index: 3, name: 'SHOPPING MALL', title: 'Shopping Mall', difficulty: 'HARD', people: 50, fires: 3, exits: 4, time: 90,
    obstacles: 'High', blockedCorridors: 4, fireSpread: 0.1, reaction: 6, spawnClearance: 4, exitCapacity: 2, suppression: 8, seed: 37, spawnTypes: [CELL.ROOM, CELL.CORRIDOR],
    blurb: 'A crowded main hall with barricaded corridors and three fires.', build: buildMall },
  { id: 'campus', index: 4, name: 'UNIVERSITY CAMPUS', title: 'University Campus', difficulty: 'EXTREME', people: 75, fires: 4, exits: 4, time: 120,
    obstacles: 'Very high', blockedCorridors: 0, fireSpread: 0.12, reaction: 8, spawnClearance: 4, exitCapacity: 1.8, suppression: 10, seed: 41, spawnTypes: [CELL.ROOM],
    blurb: 'Six buildings, a tree-lined quad and four fires spreading between them.', build: buildCampus }
];

export const getLevel = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
