import { CELL, CELL_SIZE as CS, GRID_W, GRID_H } from './constants.js';
import { Exit } from './entities.js';

/** Static description of a level: rooms, walls, corridors, doors, obstacles, exits and the grid. */
export class Building {
  constructor(map, exitCapacity = 2.5) {
    this.w = GRID_W; this.h = GRID_H;
    this.grid = Uint8Array.from(map.cells);
    this.rooms = map.rooms;
    this.corridors = map.corridors;
    this.initialBlocked = map.blocked;
    this.initialFires = map.fires;
    this.trees = new Set(map.trees || []);
    this.doors = []; this.obstacles = []; this.exits = []; this.walls = [];
    for (let i = 0; i < this.grid.length; i++) {
      const t = this.grid[i], x = i % this.w, y = (i / this.w) | 0;
      if (t === CELL.DOOR) this.doors.push({ x, y, i });
      else if (t === CELL.OBSTACLE) this.obstacles.push({ x, y, i });
      else if (t === CELL.EXIT) this.exits.push(new Exit(this.exits.length, i, x * CS + CS / 2, y * CS + CS / 2, exitCapacity));
    }
    this._buildWalls();
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  typeAt(x, y) { return this.inBounds(x, y) ? this.grid[y * this.w + x] : CELL.WALL; }
  isWalkableType(t) { return t !== CELL.WALL && t !== CELL.OBSTACLE; }
  cellRect(i) { return { x: (i % this.w) * CS, y: ((i / this.w) | 0) * CS, w: CS, h: CS }; }

  _isOpenCell(x, y) { return this.inBounds(x, y) && this.grid[y * this.w + x] !== CELL.WALL; }

  /** Wall rectangles (row runs of wall cells that touch open space) + merged boundary segments for line-of-sight. */
  _buildWalls() {
    for (let y = 0; y < this.h; y++) {
      let runStart = -1;
      for (let x = 0; x <= this.w; x++) {
        let edge = false;
        if (x < this.w && this.grid[y * this.w + x] === CELL.WALL) {
          edge = this._isOpenCell(x + 1, y) || this._isOpenCell(x - 1, y) || this._isOpenCell(x, y + 1) || this._isOpenCell(x, y - 1);
        }
        if (edge && runStart < 0) runStart = x;
        if (!edge && runStart >= 0) { this.walls.push({ x: runStart * CS, y: y * CS, w: (x - runStart) * CS, h: CS }); runStart = -1; }
      }
    }
    const segs = [];
    // horizontal boundaries between row y-1 and y
    for (let y = 0; y <= this.h; y++) {
      let start = -1;
      for (let x = 0; x <= this.w; x++) {
        const a = y > 0 && x < this.w ? this.grid[(y - 1) * this.w + x] !== CELL.WALL : false;
        const b = y < this.h && x < this.w ? this.grid[y * this.w + x] !== CELL.WALL : false;
        const on = x < this.w && a !== b && (y === 0 || y === this.h ? false : true);
        if (on && start < 0) start = x;
        if (!on && start >= 0) { segs.push({ a: { x: start * CS, y: y * CS }, b: { x: x * CS, y: y * CS } }); start = -1; }
      }
    }
    for (let x = 0; x <= this.w; x++) {
      let start = -1;
      for (let y = 0; y <= this.h; y++) {
        const a = x > 0 && y < this.h ? this.grid[y * this.w + x - 1] !== CELL.WALL : false;
        const b = x < this.w && y < this.h ? this.grid[y * this.w + x] !== CELL.WALL : false;
        const on = y < this.h && a !== b && (x === 0 || x === this.w ? false : true);
        if (on && start < 0) start = y;
        if (!on && start >= 0) { segs.push({ a: { x: x * CS, y: start * CS }, b: { x: x * CS, y: y * CS } }); start = -1; }
      }
    }
    this.wallSegments = segs;
  }
}
