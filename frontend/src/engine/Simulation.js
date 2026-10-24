import { CELL, CELL_STATE, STATUS, GRID_W as W, GRID_H as H, CELL_SIZE as CS } from '../game/constants.js';
import { Building } from '../game/Building.js';
import { Person, Fire } from '../game/entities.js';
import { PathGrid, AStarSearch } from '../algorithms/astar.js';
import { bfs, labelRegions } from '../algorithms/floodfill.js';
import { Mat3 } from '../algorithms/transform.js';
import { circleVsRect, segmentVsRect, collisionStats, resetCollisionStats } from '../algorithms/geometry.js';
import { mulberry32, shuffle } from '../utils/rng.js';

const STEP = 0.05;            // fixed simulation step (seconds)
const FIRE_INTERVAL = 0.8;    // fire propagation tick
const SMOKE_INTERVAL = 0.5;   // smoke propagation tick
const PERSON_R = 4.5;
const PATH_BUDGET = 10;       // max A* searches per step (keeps frames smooth in crowded levels)
const DANGER_SMOKE = 0.65;
const TYPE_FLAMMABILITY = { [CELL.OBSTACLE]: 1.6, [CELL.ROOM]: 1.15, [CELL.CORRIDOR]: 1, [CELL.DOOR]: 0.9, [CELL.OUTDOOR]: 0.55, [CELL.EXIT]: 0.8 };

/**
 * Simulation = game state + update loop. It owns fire / smoke grids, people, exits, score and timer.
 * Pipeline per step:  Game State → Update (fire, smoke, people) → Algorithms (BFS, A*, collisions) → (renderer reads state)
 */
export class Simulation {
  constructor(level, opts = {}) {
    this.level = level;
    this.headless = !!opts.headless;
    this.mods = opts.mods || {};
    this.onEnd = null;
    this.reset();
  }

  /* ───────────────────────── setup ───────────────────────── */
  reset() {
    const L = this.level;
    this.building = new Building(L.build(), L.exitCapacity);
    const b = this.building;
    this.N = W * H;
    this.rngPeople = mulberry32(L.seed);
    this.rngFire = mulberry32(L.seed * 7 + 13);
    this.rngMods = mulberry32(L.seed * 31 + 5);

    this.fireId = new Int16Array(this.N).fill(-1);
    this.fireDepth = new Uint8Array(this.N);
    this.fireBorn = new Float32Array(this.N);
    this.smoke = new Float32Array(this.N);
    this.fireDist = new Uint8Array(this.N).fill(255);
    this.blocked = new Uint8Array(this.N);
    this.occupancy = new Uint8Array(this.N);
    this.inFrontier = new Uint8Array(this.N);
    this.frontier = [];
    this.exitAt = new Map(b.exits.map((e) => [e.cell, e]));
    this.pathGrid = new PathGrid(W, H);

    this.fires = []; this.persons = [];
    this.status = 'READY'; this.time = 0; this.timeLeft = L.time; this.speed = 1; this.accum = 0;
    this.visualTime = 0; this.score = 0; this.result = null;
    this.fireTimer = 0; this.smokeTimer = 0; this.smokeRadius = 0; this.smokeCells = 0;
    this.fireCells = 0; this.cellsProcessed = 0; this.cellsAffected = 0; this.floodProcessed = 0; this.regions = { count: 0, largest: 0 };
    this.routeCalculations = 0; this.collisions = 0; this.blockedStops = 0; this.fireEvents = 0; this.firesContained = 0;
    this.safeRoutes = 0; this.exitsLost = 0; this.dangerEntries = 0; this.deaths = 0; this.evacuated = 0; this.lastEvacTime = 0;
    this.astar = null; this.astarTotals = { calls: 0, expanded: 0, ms: 0, failed: 0 };
    this.hazardVersion = 0; this.smokeVersion = 0; this.pathDirty = true; this.pathSyncedAt = -1;
    this.suppressionMax = L.suppression; this.suppression = L.suppression;
    this.logs = []; this.toasts = []; this.soundQueue = []; this.structureVersion = 0;
    this.clipTotals = { tested: 0, clipped: 0, rejected: 0, visible: 0 };
    this.clipView = { tested: 0, clipped: 0, rejected: 0, visible: 0 };
    resetCollisionStats();

    b.initialBlocked.forEach(({ x, y }) => { this.blocked[y * W + x] = 1; });
    b.initialFires.forEach(({ x, y }) => { this._newFire(x, y, -10, true); });
    this.fireEvents = b.initialFires.length;
    this._spawnPeople();
    this._applyMods();
    this._syncPathGrid();
  }

  _spawnPeople() {
    const L = this.level, b = this.building, rng = this.rngPeople;
    const cands = [];
    for (let i = 0; i < this.N; i++) {
      if (!L.spawnTypes.includes(b.grid[i]) || this.blocked[i]) continue;
      if (this._minFireDistance(i) < (L.spawnClearance || 6)) continue;
      cands.push(i);
    }
    shuffle(cands, rng);
    for (let k = 0; k < L.people; k++) {
      const i = cands[k % cands.length], cx = i % W, cy = (i / W) | 0;
      const off = { x: (rng() - 0.5) * 7, y: (rng() - 0.5) * 7 };
      const p = new Person(k, cx * CS + CS / 2 + off.x, cy * CS + CS / 2 + off.y, i, 34 + rng() * 18, 0.5 + rng() * (L.reaction || 4), off);
      p.heading = rng() * Math.PI * 2;
      this.persons.push(p);
    }
  }
  _minFireDistance(i) {
    const x = i % W, y = (i / W) | 0; let best = 99;
    for (const f of this.fires) best = Math.min(best, Math.abs(f.cell % W - x) + Math.abs(((f.cell / W) | 0) - y));
    return best;
  }
  _applyMods() {
    const m = this.mods, b = this.building, rng = this.rngMods;
    if (m.closeExit != null && b.exits[m.closeExit]) { const e = b.exits[m.closeExit]; e.closed = true; e.isOpen = false; }
    if (m.blockCorridors) {
      const cand = [];
      for (let i = 0; i < this.N; i++) if ([CELL.CORRIDOR, CELL.DOOR, CELL.OUTDOOR].includes(b.grid[i]) && !this.blocked[i] && !this._nearExit(i, 3)) cand.push(i);
      shuffle(cand, rng).slice(0, m.blockCorridors).forEach((i) => { this.blocked[i] = 1; });
    }
    if (m.extraFires) {
      const cand = [];
      for (let i = 0; i < this.N; i++) if ([CELL.ROOM, CELL.CORRIDOR, CELL.OUTDOOR].includes(b.grid[i]) && this._minFireDistance(i) > 6) cand.push(i);
      shuffle(cand, rng).slice(0, m.extraFires).forEach((i) => { this._newFire(i % W, (i / W) | 0, -10, true); this.fireEvents++; });
    }
    if (m.alarmDelay) this.persons.forEach((p) => { p.delay += m.alarmDelay; });
    this.hazardVersion++; this.pathDirty = true; this.structureVersion++;
  }
  _nearExit(i, r) {
    const x = i % W, y = (i / W) | 0;
    return this.building.exits.some((e) => Math.abs((e.cell % W) - x) + Math.abs(((e.cell / W) | 0) - y) <= r);
  }

  /* ───────────────────────── control ───────────────────────── */
  start() {
    if (this.status !== 'READY') return;
    this.status = 'RUNNING';
    this.log('ALARM', 'Evacuation alarm triggered', 'warn');
    this.soundQueue.push('alarm');
  }
  pause() { if (this.status === 'RUNNING') this.status = 'PAUSED'; }
  resume() { if (this.status === 'PAUSED') this.status = 'RUNNING'; }
  setSpeed(s) { this.speed = s; }

  /** Called every animation frame with real elapsed seconds. */
  update(realDt) {
    this.visualTime += realDt;
    if (this.status !== 'RUNNING') return;
    this.accum += realDt * this.speed;
    let n = 0;
    while (this.accum >= STEP && n < 24 && this.status === 'RUNNING') { this.step(STEP); this.accum -= STEP; n++; }
    if (n >= 24) this.accum = 0;
  }

  /* ───────────────────────── main step ───────────────────────── */
  step(dt) {
    if (this.status !== 'RUNNING') return;
    this.time += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.suppression = Math.min(this.suppressionMax, this.suppression + dt / 6);

    this.fireTimer += dt;
    while (this.fireTimer >= FIRE_INTERVAL) { this.fireTimer -= FIRE_INTERVAL; this._fireTick(); }
    this.smokeTimer += dt;
    while (this.smokeTimer >= SMOKE_INTERVAL) { this.smokeTimer -= SMOKE_INTERVAL; this._smokeTick(); }

    this._updateOccupancy();
    for (const p of this.persons) this._updatePerson(p, dt);
    this._processPaths();
    for (const e of this.building.exits) e.tokens = Math.min(Math.max(1, e.capacity), e.tokens + e.capacity * dt);

    if (this.timeLeft <= 0 || this._unresolved() === 0) this._finish();
  }
  _unresolved() { let n = 0; for (const p of this.persons) if (!p.done) n++; return n; }

  /* ───────────────────────── fire (BFS frontier) ───────────────────────── */
  _newFire(cx, cy, born, silent) {
    const i = cy * W + cx;
    const f = new Fire(this.fires.length, i, cx * CS + CS / 2, cy * CS + CS / 2, this.level.fireSpread);
    this.fires.push(f);
    this._ignite(i, f, 0, born);
    return f;
  }
  _ignite(i, fire, depth, born = this.visualTime, queue = true) {
    this.fireId[i] = fire.id; this.fireDepth[i] = Math.min(255, depth); this.fireBorn[i] = born;
    fire.cells++; fire.radius = Math.max(fire.radius, depth); this.fireCells++; this.cellsAffected++;
    this.fireDist[i] = 0;
    if (queue && !this.inFrontier[i]) { this.inFrontier[i] = 1; this.frontier.push(i); }
    const ex = this.exitAt.get(i);
    if (ex && !ex.burning) { ex.burning = true; this._refreshExit(ex, true); }
    this._bump();
  }
  _bump() { this.hazardVersion++; this.pathDirty = true; }
  _spreadChance(j, fire) {
    const t = this.building.grid[j];
    return fire.spreadRate * (TYPE_FLAMMABILITY[t] || 1) * (1 + Math.min(0.8, this.time / 200));
  }
  /** One propagation wave: every frontier cell tries to ignite its 4 neighbours (BFS-style growth). */
  _fireTick() {
    const next = [], g = this.building.grid, rng = this.rngFire;
    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    for (const i of this.frontier) {
      this.cellsProcessed++;
      if (this.fireId[i] < 0) { this.inFrontier[i] = 0; continue; }
      const fire = this.fires[this.fireId[i]];
      const x = i % W, y = (i / W) | 0;
      let free = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (g[j] === CELL.WALL || this.fireId[j] >= 0) continue;
        free = true;
        if (rng() < this._spreadChance(j, fire)) {
          this._ignite(j, fire, this.fireDepth[i] + 1, this.visualTime, false);
          this.inFrontier[j] = 1;
          next.push(j);
        }
      }
      if (free) next.push(i); else this.inFrontier[i] = 0;
    }
    this.frontier = next;
  }

  /* ───────────────────────── smoke (multi-source BFS) ───────────────────────── */
  _smokeTick() {
    const g = this.building.grid;
    const sources = [];
    for (let i = 0; i < this.N; i++) if (this.fireId[i] >= 0) sources.push(i);
    this.fireCells = sources.length;
    const growth = this.level.smokeRate ?? 1;
    this.smokeRadius = sources.length ? Math.min(16, 3 + this.time * 0.07 * growth + Math.sqrt(sources.length) * 0.8) : 0;
    const res = bfs(W, H, sources, (j) => g[j] !== CELL.WALL, { maxDepth: Math.ceil(this.smokeRadius) });
    this.floodProcessed += res.processed;
    const R = this.smokeRadius + 1;
    let cells = 0;
    for (let i = 0; i < this.N; i++) {
      const d = res.dist[i];
      this.fireDist[i] = d < 0 ? 255 : d;
      const target = d < 0 || g[i] === CELL.WALL ? 0 : Math.pow(Math.max(0, 1 - d / R), 0.85) * 0.95;
      this.smoke[i] += (target - this.smoke[i]) * 0.3;
      if (this.smoke[i] < 0.01) this.smoke[i] = 0;
      if (this.smoke[i] > 0.1) cells++;
    }
    this.smokeCells = cells;
    this.smokeVersion++;
    this.pathDirty = true;
    const reg = labelRegions(W, H, (i) => this.fireId[i] >= 0 || this.smoke[i] > DANGER_SMOKE);
    this.regions = { count: reg.count, largest: reg.largest };
    this.fireRadius = this.fires.reduce((m, f) => (f.cells > 0 ? Math.max(m, f.radius) : m), 0);
  }

  /* ───────────────────────── path grid sync ───────────────────────── */
  _syncPathGrid() {
    const b = this.building;
    for (let i = 0; i < this.N; i++) {
      const n = this.pathGrid.nodes[i], t = b.grid[i], ex = this.exitAt.get(i);
      const sm = this.smoke[i], fd = this.fireDist[i];
      n.walkable = t !== CELL.WALL && t !== CELL.OBSTACLE && !this.blocked[i] && this.fireId[i] < 0 && !(ex && !ex.isOpen);
      n.dangerous = sm > DANGER_SMOKE;
      n.occupied = this.occupancy[i] > 0;
      n.cost = sm * 4 + (fd <= 1 ? 3 : fd === 2 ? 1 : 0);
    }
    this.pathDirty = false;
  }
  _updateOccupancy() {
    this.occupancy.fill(0);
    for (const p of this.persons) if (!p.done) this.occupancy[p.currentCell]++;
  }

  /* ───────────────────────── people ───────────────────────── */
  cellOf(x, y) { return Math.min(H - 1, Math.max(0, Math.floor(y / CS))) * W + Math.min(W - 1, Math.max(0, Math.floor(x / CS))); }
  _hazardAt(i) {
    if (this.fireId[i] >= 0) return 'FIRE';
    if (this.blocked[i]) return 'BLOCKED';
    const ex = this.exitAt.get(i);
    if (ex && !ex.isOpen) return 'EXIT CLOSED';
    return null;
  }

  _updatePerson(p, dt) {
    if (p.done) return;
    const i = this.cellOf(p.position.x, p.position.y);
    p.currentCell = i;
    // environment effects ------------------------------------------------
    const onFire = this.fireId[i] >= 0, sm = this.smoke[i], fd = this.fireDist[i];
    if (onFire) p.health -= 45 * dt; else if (sm > 0.45) p.health -= (sm - 0.35) * 8 * dt;
    p.riskLevel = Math.min(1, sm * 0.9 + (fd <= 3 ? (4 - fd) * 0.12 : 0) + (onFire ? 1 : 0));
    if (p.riskLevel > p.peakRisk) p.peakRisk = p.riskLevel;
    const inDanger = onFire || sm > DANGER_SMOKE;
    if (inDanger && !p.inDanger) { this.score -= 200; this.dangerEntries++; this.log('DANGER', `Person #${p.id} entered a danger zone  −200`, 'bad'); }
    p.inDanger = inDanger;
    if (p.health <= 0) {
      p.health = 0; p.dead = true; p.done = true; p.status = STATUS.TRAPPED; this.deaths++;
      if (!p.trapPenalized) { p.trapPenalized = true; this.score -= 100; }
      this.log('LOST', `Person #${p.id} was lost  −100`, 'bad'); this.soundQueue.push('warning');
      return;
    }
    // reaction delay -----------------------------------------------------
    if (p.delay > 0) { p.delay -= dt; if (p.delay <= 0) p.needsPath = true; this._setStatus(p); return; }
    if (p.noRoute && this.time >= p.retryAt) p.needsPath = true;
    if (!p.needsPath && !p.noRoute) {
      this._validateRoute(p);
      if (!p.needsPath) this._move(p, dt);
    }
    this._setStatus(p);
  }
  _setStatus(p) {
    if (p.done) return;
    if (p.delay > 0) p.status = STATUS.SAFE;
    else if (p.noRoute) p.status = STATUS.TRAPPED;
    else if (p.riskLevel > 0.3) p.status = STATUS.AT_RISK;
    else p.status = STATUS.EVACUATING;
  }

  /** Detect that the current route is blocked (fire / debris / closed exit / dense smoke). */
  _validateRoute(p) {
    if (!p.path.length) return;
    let bad = false, reason = '';
    if (p.pathVersion !== this.hazardVersion) {
      for (let k = p.pathIndex; k < p.path.length; k++) { const h = this._hazardAt(p.path[k]); if (h) { bad = true; reason = h; break; } }
      p.pathVersion = this.hazardVersion;
    }
    if (!bad && !p.desperate && p.smokeVersion !== this.smokeVersion) {
      for (let k = p.pathIndex; k < Math.min(p.path.length, p.pathIndex + 6); k++) if (this.smoke[p.path[k]] > DANGER_SMOKE) { bad = true; reason = 'SMOKE'; break; }
      p.smokeVersion = this.smokeVersion;
    }
    if (bad) this._routeBlocked(p, reason);
  }
  _routeBlocked(p, reason) {
    p.needsPath = true; p.pendingReroute = true;
    this.log('ROUTE', `Route blocked for #${p.id} (${reason}) — recalculating`, 'warn');
    this._toast(p, 'ROUTE BLOCKED', 'RECALCULATING PATH...');
  }

  _move(p, dt) {
    if (p.pathIndex >= p.path.length) { this._tryExit(p); return; }
    const ti = p.path[p.pathIndex];
    const tx = (ti % W) * CS + CS / 2 + p.offset.x, ty = ((ti / W) | 0) * CS + CS / 2 + p.offset.y;
    const sm = this.smoke[p.currentCell];
    const stepLen = p.speed * dt * (1 - 0.45 * sm);
    const dx = tx - p.position.x, dy = ty - p.position.y, dist = Math.hypot(dx, dy);
    let nx = tx, ny = ty;
    if (dist > stepLen) {
      // 2D translation matrix moves the person along the heading
      const T = Mat3.translation((dx / dist) * stepLen, (dy / dist) * stepLen);
      ({ x: nx, y: ny } = T.apply(p.position.x, p.position.y));
    }
    const hit = this._collide(p, nx, ny);
    if (hit) {
      collisionStats.collisions++;
      if (this.time - p.lastCollision > 0.4) {
        this.collisions++; collisionStats.blocked++; this.blockedStops++;
        p.lastCollision = this.time;
        this.log('COLLISION', `Collision detected: #${p.id} vs ${hit} — stop & reroute`, 'warn');
      }
      p.pendingReroute = true; p.needsPath = true;
      this._toast(p, 'ROUTE BLOCKED', 'RECALCULATING PATH...');
      return;
    }
    if (dist > 0.01) p.heading = Math.atan2(dy, dx);
    p.position.x = nx; p.position.y = ny;
    if (dist <= stepLen) p.pathIndex++;
    p.currentCell = this.cellOf(nx, ny);
    if (p.pathIndex >= p.path.length && this.exitAt.has(p.path[p.path.length - 1])) this._tryExit(p);
  }

  /** Circle-vs-rect on the 3×3 neighbourhood + segment-vs-rect for the movement segment. */
  _collide(p, nx, ny) {
    const own = this.cellOf(p.position.x, p.position.y);
    const cx = Math.floor(nx / CS), cy = Math.floor(ny / CS);
    const circle = { x: nx, y: ny, r: PERSON_R };
    const a = { x: p.position.x, y: p.position.y }, b = { x: nx, y: ny };
    const g = this.building.grid;
    for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (j === own) continue;
      let why = null;
      if (g[j] === CELL.WALL) why = 'WALL'; else if (g[j] === CELL.OBSTACLE) why = 'OBSTACLE'; else why = this._hazardAt(j);
      if (!why) continue;
      const rect = { x: xx * CS, y: yy * CS, w: CS, h: CS };
      if (circleVsRect(circle, rect) || segmentVsRect(a, b, rect)) return why;
    }
    return null;
  }

  _tryExit(p) {
    const ex = this.exitAt.get(p.currentCell);
    if (!ex) { p.needsPath = true; return; }
    if (!ex.isOpen) { p.needsPath = true; p.pendingReroute = true; return; }
    if (ex.tokens < 1) return;               // exit capacity: wait in the queue
    ex.tokens -= 1; ex.used++;
    p.done = true; p.status = STATUS.EVACUATED; p.targetExit = ex; this.evacuated++;
    this.lastEvacTime = this.time;
    this.score += 100 + 10;
    this.log('EVAC', `Person #${p.id} evacuated via EXIT ${ex.id + 1}  +110`, 'good');
    this.soundQueue.push('evac');
  }

  /* ───────────────────────── A* routing ───────────────────────── */
  _processPaths() {
    let budget = PATH_BUDGET;
    for (const p of this.persons) {
      if (budget <= 0) break;
      if (p.done || p.delay > 0 || !p.needsPath) continue;
      if (this.pathDirty) this._syncPathGrid();
      this._computePath(p); budget--;
    }
  }
  _computePath(p) {
    const start = { x: p.currentCell % W, y: (p.currentCell / W) | 0 };
    const goals = this.building.exits.filter((e) => e.isOpen).map((e) => ({ x: e.cell % W, y: (e.cell / W) | 0 }));
    p.needsPath = false;
    let s = null;
    if (goals.length) {
      s = new AStarSearch(this.pathGrid, start, goals, { heuristic: 'manhattan', allowDangerous: false });
      s.run();
      p.desperate = false;
      if (!s.found) { s = new AStarSearch(this.pathGrid, start, goals, { heuristic: 'manhattan', allowDangerous: true }); s.run(); p.desperate = true; }
    }
    this.routeCalculations++; p.routeCalcs++;
    if (s) { this.astarTotals.calls++; this.astarTotals.expanded += s.expanded; this.astarTotals.ms += s.ms; this.astar = s.snapshot(); p.lastAStar = this.astar; }
    if (s && s.found) {
      const nodes = s.path();
      p.path = nodes.slice(1).map((n) => n.id);
      p.pathIndex = 0; p.targetExit = this.exitAt.get(nodes[nodes.length - 1].id);
      p.pathVersion = this.hazardVersion; p.smokeVersion = this.smokeVersion;
      p.noRoute = false;
      if (p.pendingReroute) { this.score += 25; this.safeRoutes++; this.log('ROUTE', `Safe route created for #${p.id} → EXIT ${p.targetExit.id + 1}  +25`, 'good'); }
      p.pendingReroute = false;
      if (!p.path.length) this._tryExit(p);
    } else {
      this.astarTotals.failed++;
      p.path = []; p.noRoute = true; p.retryAt = this.time + 1.5; p.pendingReroute = true;
      if (!p.trapPenalized) { p.trapPenalized = true; this.score -= 100; this.log('TRAPPED', `Person #${p.id} is trapped — no safe route  −100`, 'bad'); this.soundQueue.push('warning'); }
    }
  }

  /* ───────────────────────── player tools ───────────────────────── */
  applyTool(tool, cx, cy, wx, wy) {
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return { ok: false, msg: 'Invalid grid cell' };
    if (this.status === 'ENDED') return { ok: false, msg: 'Mission over' };
    const i = cy * W + cx, t = this.building.grid[i];
    switch (tool) {
      case 'fire': {
        if (t === CELL.WALL) return { ok: false, msg: 'Cannot ignite a wall' };
        if (this.fireId[i] >= 0) return { ok: false, msg: '' };
        this._newFire(cx, cy, this.visualTime); this.fireEvents++; this.log('FIRE', `New fire started at (${cx},${cy})`, 'bad');
        this.soundQueue.push('warning');
        return { ok: true, msg: 'Fire placed' };
      }
      case 'extinguish': {
        if (this.suppression < 1) return { ok: false, msg: 'Suppression recharging…' };
        const touched = new Set(); let cleared = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = y * W + x, id = this.fireId[j];
          if (id < 0) continue;
          this.fireId[j] = -1; this.fires[id].cells--; this.fireCells--; cleared++; touched.add(id);
          const ex = this.exitAt.get(j); if (ex) { ex.burning = false; this._refreshExit(ex, false); }
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {   // re-seed frontier next to the gap
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const k = ny * W + nx; if (this.fireId[k] >= 0 && !this.inFrontier[k]) { this.inFrontier[k] = 1; this.frontier.push(k); }
          }
        }
        if (!cleared) return { ok: false, msg: 'No fire there' };
        this.suppression -= 1;
        for (const id of touched) { const f = this.fires[id]; if (f.cells <= 0 && f.active) { f.active = false; this.firesContained++; this.score += 50; this.log('FIRE', `Fire #${id + 1} contained  +50`, 'good'); this.soundQueue.push('evac'); } }
        this._bump(); this._smokeTick();
        return { ok: true, msg: `Suppressed ${cleared} cells` };
      }
      case 'block': {
        if (t === CELL.WALL || t === CELL.OBSTACLE || t === CELL.EXIT) return { ok: false, msg: 'Cannot block here' };
        if (this.blocked[i]) return { ok: false, msg: '' };
        if (this.occupancy[i] > 0) return { ok: false, msg: 'Cell occupied' };
        this.blocked[i] = 1; this.structureVersion++; this._bump(); this.log('BLOCK', `Corridor blocked at (${cx},${cy})`, 'warn');
        return { ok: true, msg: 'Blocked' };
      }
      case 'unblock': {
        if (!this.blocked[i]) return { ok: false, msg: '' };
        this.blocked[i] = 0; this.structureVersion++; this._bump(); this.log('BLOCK', `Corridor cleared at (${cx},${cy})`, 'good');
        return { ok: true, msg: 'Cleared' };
      }
      case 'openExit': case 'closeExit': {
        let best = null, bd = 90;
        for (const e of this.building.exits) { const d = Math.hypot(e.position.x - wx, e.position.y - wy); if (d < bd) { bd = d; best = e; } }
        if (!best) return { ok: false, msg: 'No exit near click' };
        return this.setExitOpen(best.id, tool === 'openExit');
      }
      default: return { ok: false, msg: '' };
    }
  }
  setExitOpen(id, open) {
    const e = this.building.exits[id];
    if (!e) return { ok: false, msg: 'Invalid exit' };
    if (open && e.burning) return { ok: false, msg: `EXIT ${id + 1} is on fire` };
    if (e.closed === !open) return { ok: false, msg: '' };
    e.closed = !open; this._refreshExit(e, false); this._bump();
    this.log('EXIT', `EXIT ${id + 1} ${open ? 'opened' : 'closed'}`, open ? 'good' : 'warn');
    return { ok: true, msg: `Exit ${id + 1} ${open ? 'opened' : 'closed'}` };
  }
  _refreshExit(e, byFire) {
    const was = e.isOpen;
    e.isOpen = !e.closed && !e.burning;
    if (was && !e.isOpen && byFire) { this.score -= 50; this.exitsLost++; this.log('EXIT', `EXIT ${e.id + 1} became unavailable  −50`, 'bad'); this.soundQueue.push('warning'); }
    this.structureVersion++;
  }

  /* ───────────────────────── cell state ───────────────────────── */
  cellState(i) {
    if (this.fireId[i] >= 0) return CELL_STATE.FIRE;
    if (this.blocked[i] || this._hazardAt(i)) return CELL_STATE.BLOCKED;
    if (this.smoke[i] > 0.35) return CELL_STATE.SMOKE;
    return CELL_STATE.SAFE;
  }

  /* ───────────────────────── events / log ───────────────────────── */
  log(type, text, kind = 'info') {
    if (this.headless) return;
    this.logs.push({ t: this.time, type, text, kind });
    if (this.logs.length > 60) this.logs.shift();
  }
  _toast(p, text, sub) {
    if (this.headless) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - (this._lastToast || 0) < 350) return;
    this._lastToast = now;
    this.toasts.push({ text, sub, x: p.position.x, y: p.position.y, born: now });
    if (this.toasts.length > 6) this.toasts.shift();
    this.lastBanner = { text, sub, born: now };
  }

  /* ───────────────────────── result ───────────────────────── */
  _finish() {
    if (this.status === 'ENDED') return;
    this.status = 'ENDED';
    const total = this.persons.length, saved = this.evacuated;
    const survival = total ? saved / total : 0;
    const success = survival >= 0.6;
    const timeBonus = success ? Math.floor(this.timeLeft) * 5 : 0;
    const mean = this.persons.reduce((s, p) => s + p.peakRisk, 0) / Math.max(1, total);
    const riskIdx = mean * 0.6 + (this.deaths / Math.max(1, total)) * 2 + (this.dangerEntries / Math.max(1, total)) * 0.2;
    const stars = success ? (survival >= 0.95 ? 5 : survival >= 0.85 ? 4 : survival >= 0.75 ? 3 : survival >= 0.65 ? 2 : 1) : survival >= 0.4 ? 1 : 0;
    this.result = {
      levelId: this.level.id, levelName: this.level.name, outcome: success ? 'COMPLETE' : 'FAILED',
      peopleTotal: total, peopleSaved: saved, peopleLost: this.deaths, peopleRemaining: total - saved - this.deaths,
      survivalRate: survival, evacuationTime: +(saved ? this.lastEvacTime : this.time).toFixed(1),
      score: Math.max(0, Math.round(this.score + timeBonus)), baseScore: Math.round(this.score), timeBonus,
      routeCalculations: this.routeCalculations, collisionCount: this.collisions, fireEvents: this.fireEvents,
      fireArea: this.fireCells, firesContained: this.firesContained, exitsLost: this.exitsLost, safeRoutes: this.safeRoutes,
      dangerEntries: this.dangerEntries, risk: riskIdx < 0.25 ? 'LOW' : riskIdx < 0.6 ? 'MEDIUM' : 'HIGH', stars,
      exitUsage: this.building.exits.map((e) => e.used),
      algo: {
        astar: { ...this.astarTotals, avgExpanded: this.astarTotals.calls ? this.astarTotals.expanded / this.astarTotals.calls : 0 },
        flood: { processed: this.floodProcessed + this.cellsProcessed, affected: this.cellsAffected, regions: this.regions.count },
        collision: { ...collisionStats }, clip: { ...this.clipTotals }
      }
    };
    this.soundQueue.push(success ? 'success' : 'gameover');
    this.log('END', success ? 'MISSION COMPLETE' : 'MISSION FAILED', success ? 'good' : 'bad');
    if (this.onEnd) this.onEnd(this.result);
  }

  /* ───────────────────────── snapshot for React HUD ───────────────────────── */
  snapshot(selectedId = null) {
    const c = { safe: 0, evacuating: 0, atRisk: 0, trapped: 0, evacuated: 0 };
    for (const p of this.persons) {
      if (p.status === STATUS.SAFE) c.safe++; else if (p.status === STATUS.EVACUATING) c.evacuating++;
      else if (p.status === STATUS.AT_RISK) c.atRisk++; else if (p.status === STATUS.TRAPPED) c.trapped++; else c.evacuated++;
    }
    const sel = this.persons.find((p) => p.id === selectedId) || this.persons.find((p) => !p.done) || this.persons[0];
    let transform = null;
    if (sel) {
      const risk = sel.riskLevel, s = 1 + 0.25 * risk;
      const M = Mat3.compose(Mat3.translation(sel.position.x, sel.position.y), Mat3.rotation(sel.heading), Mat3.scaling(s, s));
      transform = { id: sel.id, status: sel.status, tx: sel.position.x, ty: sel.position.y, theta: sel.heading, sx: s, sy: s, rows: M.rows(2) };
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      status: this.status, time: this.time, timeLeft: this.timeLeft, score: Math.round(this.score), speed: this.speed,
      people: { total: this.persons.length, ...c, lost: this.deaths, remaining: this._unresolved() },
      fire: { count: this.fires.filter((f) => f.active && f.cells > 0).length, cells: this.fireCells, radius: this.fireRadius || 0, processed: this.cellsProcessed, affected: this.cellsAffected, spreadRate: this.level.fireSpread },
      smoke: { radius: +this.smokeRadius.toFixed(1), cells: this.smokeCells, processed: this.floodProcessed },
      regions: this.regions,
      exits: this.building.exits.map((e) => ({ id: e.id, isOpen: e.isOpen, closed: e.closed, burning: e.burning, used: e.used })),
      astar: this.astar, astarTotals: { ...this.astarTotals },
      collision: { ...collisionStats },
      clip: { ...this.clipView },
      transform, selectedId: sel ? sel.id : null,
      routeCalculations: this.routeCalculations, collisions: this.collisions, fireEvents: this.fireEvents,
      suppression: this.suppression, suppressionMax: this.suppressionMax,
      banner: this.lastBanner && now - this.lastBanner.born < 1800 ? this.lastBanner : null,
      logs: this.logs.slice(-9).reverse()
    };
  }
}
