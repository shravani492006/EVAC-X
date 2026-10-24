/**
 * Flood Fill / BFS on a 4-connected grid (manual, queue based).
 * Used by: smoke propagation (multi-source BFS), danger-region labelling,
 * the fire frontier, and the Algorithm Lab.
 */
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Multi-source BFS. `passable(i)` decides which cells can be entered.
 * Returns distance + parent arrays and statistics.
 */
export function bfs(w, h, starts, passable, { maxDepth = Infinity, goal = -1 } = {}) {
  const N = w * h;
  const dist = new Int16Array(N).fill(-1);
  const parent = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  let head = 0, tail = 0, processed = 0;
  for (const s of starts) if (dist[s] < 0) { dist[s] = 0; queue[tail++] = s; }
  while (head < tail) {
    const i = queue[head++];
    processed++;
    if (i === goal) break;
    if (dist[i] >= maxDepth) continue;
    const x = i % w, y = (i / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS4[d][0], ny = y + DIRS4[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist[j] >= 0 || !passable(j)) continue;
      dist[j] = dist[i] + 1;
      parent[j] = i;
      queue[tail++] = j;
    }
  }
  return { dist, parent, processed, affected: tail, reached: goal >= 0 && dist[goal] >= 0 };
}

export function extractPath(parent, goal) {
  const path = [];
  for (let i = goal; i >= 0; i = parent[i]) path.push(i);
  return path.reverse();
}

/** Step-by-step BFS (one wave / layer per step) for visualisation. */
export class FloodFillStepper {
  constructor(w, h, seeds, passable, goal = -1) {
    this.w = w; this.h = h; this.passable = passable; this.goal = goal;
    this.dist = new Int16Array(w * h).fill(-1);
    this.parent = new Int32Array(w * h).fill(-1);
    this.frontier = [];
    for (const s of seeds) if (this.dist[s] < 0) { this.dist[s] = 0; this.frontier.push(s); }
    this.layer = 0; this.processed = 0; this.affected = this.frontier.length; this.done = false; this.found = false;
  }
  step() {
    if (this.done) return this.frontier;
    const next = [];
    for (const i of this.frontier) {
      this.processed++;
      if (i === this.goal) { this.done = true; this.found = true; break; }
      const x = i % this.w, y = (i / this.w) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const j = ny * this.w + nx;
        if (this.dist[j] >= 0 || !this.passable(j)) continue;
        this.dist[j] = this.dist[i] + 1; this.parent[j] = i; next.push(j); this.affected++;
      }
    }
    if (!this.done) { this.frontier = next; this.layer++; if (!next.length) this.done = true; }
    return this.frontier;
  }
}

/** Connected-component labelling of "danger" cells (flood fill from every unlabelled seed). */
export function labelRegions(w, h, isDanger) {
  const N = w * h, labels = new Int16Array(N).fill(-1), sizes = [], stack = [];
  for (let s = 0; s < N; s++) {
    if (labels[s] >= 0 || !isDanger(s)) continue;
    const id = sizes.length; let size = 0;
    labels[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop(); size++;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (labels[j] < 0 && isDanger(j)) { labels[j] = id; stack.push(j); }
      }
    }
    sizes.push(size);
  }
  return { count: sizes.length, sizes, largest: sizes.length ? Math.max(...sizes) : 0, labels };
}
