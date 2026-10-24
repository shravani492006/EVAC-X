import { STATUS } from './constants.js';

export class Person {
  constructor(id, x, y, cell, speed, delay, offset) {
    this.id = id;
    this.position = { x, y };
    this.speed = speed;            // px / second
    this.health = 100;
    this.status = STATUS.SAFE;
    this.currentCell = cell;
    this.targetExit = null;
    this.path = [];                // array of cell indices still to visit
    this.pathIndex = 0;
    this.riskLevel = 0;            // 0..1
    this.heading = 0;              // radians
    this.delay = delay;            // reaction time before moving
    this.offset = offset;          // small lateral offset so crowds don't stack
    this.needsPath = false;
    this.pendingReroute = false;
    this.noRoute = false;
    this.retryAt = 0;
    this.desperate = false;        // route goes through dense smoke
    this.pathVersion = -1;
    this.smokeVersion = -1;
    this.lastCollision = -10;
    this.inDanger = false;
    this.trapPenalized = false;
    this.peakRisk = 0;
    this.routeCalcs = 0;
    this.done = false;             // evacuated or lost
    this.dead = false;
    this.lastAStar = null;
  }
  get x() { return this.position.x; }
  get y() { return this.position.y; }
}

export class Fire {
  constructor(id, cell, x, y, spreadRate) {
    this.id = id;
    this.cell = cell;
    this.position = { x, y };
    this.intensity = 1;
    this.radius = 0;               // in cells (BFS depth of the outermost burning cell)
    this.spreadRate = spreadRate;  // chance per neighbouring cell per fire tick
    this.cells = 0;
    this.active = true;
  }
}

export class Exit {
  constructor(id, cell, x, y, capacity) {
    this.id = id;
    this.cell = cell;
    this.position = { x, y };
    this.capacity = capacity;      // people / second that can pass
    this.isOpen = true;
    this.closed = false;           // closed by the player
    this.burning = false;          // blocked by fire
    this.tokens = capacity;
    this.used = 0;
  }
}
