/**
 * A* pathfinding — manual implementation (no libraries).
 *   f(n) = g(n) + h(n)
 *   g(n): cost from the start to n      h(n): heuristic estimate from n to the goal
 * Multiple goals (several exits) are supported: h(n) = min over goals of h(n, goal),
 * which is still admissible, so one search finds the best reachable exit.
 */
export const HEURISTICS = {
  manhattan: (dx, dy) => dx + dy,
  euclidean: (dx, dy) => Math.hypot(dx, dy),
  chebyshev: (dx, dy) => Math.max(dx, dy),
  octile: (dx, dy) => Math.max(dx, dy) + 0.4142 * Math.min(dx, dy)
};

export class Node {
  constructor(x, y, id) {
    this.x = x; this.y = y; this.id = id;
    this.g = Infinity; this.h = 0; this.f = 0; this.parent = null;
    this.walkable = true; this.dangerous = false; this.occupied = false;
    this.cost = 0;        // extra traversal cost (smoke, proximity to fire)
    this.open = false; this.closed = false; this.runId = 0;
  }
}

export class PathGrid {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.nodes = new Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.nodes[y * w + x] = new Node(x, y, y * w + x);
  }
  at(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.nodes[y * this.w + x]; }
}

let RUN_COUNTER = 0;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class AStarSearch {
  /**
   * @param grid PathGrid
   * @param start {x,y}
   * @param goals [{x,y}]
   * @param opts {heuristic:'manhattan', diagonal:false, allowDangerous:false}
   */
  constructor(grid, start, goals, opts = {}) {
    this.grid = grid;
    this.opts = { heuristic: 'manhattan', diagonal: false, allowDangerous: false, ...opts };
    this.hFn = HEURISTICS[this.opts.heuristic] || HEURISTICS.manhattan;
    this.runId = ++RUN_COUNTER;
    this.goals = goals;
    this.heap = [];
    this.openCount = 0; this.closedCount = 0; this.expanded = 0;
    this.done = false; this.found = false;
    this.current = null; this.goalNode = null; this.ms = 0;
    this.t0 = now();
    this.startNode = this._node(start.x, start.y);
    this.startNode.g = 0;
    this.startNode.h = this._h(this.startNode);
    this.startNode.f = this.startNode.h;
    this.startNode.open = true; this.openCount = 1;
    this._push(this.startNode);
  }

  _node(x, y) {
    const n = this.grid.nodes[y * this.grid.w + x];
    if (n.runId !== this.runId) { n.runId = this.runId; n.g = Infinity; n.h = 0; n.f = 0; n.parent = null; n.open = false; n.closed = false; }
    return n;
  }
  _h(n) {
    let best = Infinity;
    for (const g of this.goals) {
      const v = this.hFn(Math.abs(n.x - g.x), Math.abs(n.y - g.y));
      if (v < best) best = v;
    }
    return best === Infinity ? 0 : best;
  }
  _isGoal(n) { for (const g of this.goals) if (g.x === n.x && g.y === n.y) return true; return false; }
  _less(a, b) { return a.f < b.f || (a.f === b.f && a.h < b.h); }
  _push(n) {
    const h = this.heap; h.push(n);
    let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this._less(h[i], h[p])) break; [h[i], h[p]] = [h[p], h[i]]; i = p; }
  }
  _pop() {
    const h = this.heap; if (!h.length) return null;
    const top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < h.length && this._less(h[l], h[m])) m = l;
        if (r < h.length && this._less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]]; i = m;
      }
    }
    return top;
  }
  _passable(n) { return n.walkable && (this.opts.allowDangerous || !n.dangerous); }

  /** Expand exactly one node. Returns the node expanded (or null when finished). */
  step() {
    if (this.done) return null;
    let cur = this._pop();
    while (cur && cur.closed) cur = this._pop();
    if (!cur) { this.done = true; this._finish(); return null; }
    cur.closed = true; cur.open = false; this.openCount--; this.closedCount++; this.expanded++;
    this.current = cur;
    if (this._isGoal(cur)) { this.done = true; this.found = true; this.goalNode = cur; this._finish(); return cur; }
    const dirs = this.opts.diagonal ? N8 : N4;
    for (let d = 0; d < dirs.length; d++) {
      const dx = dirs[d][0], dy = dirs[d][1];
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= this.grid.w || ny >= this.grid.h) continue;
      const nb = this._node(nx, ny);
      if (nb.closed || !this._passable(nb)) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag) { // forbid cutting corners through walls
        const a = this.grid.at(cur.x + dx, cur.y), b = this.grid.at(cur.x, cur.y + dy);
        if (!a.walkable || !b.walkable) continue;
      }
      const step = (diag ? 1.4142 : 1) * (1 + nb.cost + (nb.dangerous ? 8 : 0) + (nb.occupied ? 0.4 : 0));
      const tentative = cur.g + step;
      if (tentative < nb.g) {
        nb.parent = cur; nb.g = tentative; nb.h = this._h(nb); nb.f = nb.g + nb.h;
        if (!nb.open) { nb.open = true; this.openCount++; }
        this._push(nb);
      }
    }
    return cur;
  }
  _finish() { this.ms = now() - this.t0; }
  run(maxSteps = 100000) { let n = 0; while (!this.done && n++ < maxSteps) this.step(); return this.found; }

  path() {
    const out = [];
    for (let n = this.goalNode; n; n = n.parent) out.push(n);
    return out.reverse();
  }
  /** Nodes belonging to this run (for visualisation). */
  touched() { return this.grid.nodes.filter((n) => n.runId === this.runId); }

  snapshot() {
    const n = this.goalNode || this.current;
    const p = this.found ? this.path() : [];
    return {
      found: this.found, done: this.done, heuristic: this.opts.heuristic,
      currentNode: n ? `N${n.id}` : '—', g: n ? +n.g.toFixed(1) : 0, h: n ? +n.h.toFixed(1) : 0, f: n ? +n.f.toFixed(1) : 0,
      open: this.openCount, closed: this.closedCount, expanded: this.expanded,
      pathLength: p.length ? p.length - 1 : 0, ms: +this.ms.toFixed(2)
    };
  }
}
