import test from 'node:test';
import assert from 'node:assert/strict';
import { bfs, FloodFillStepper, labelRegions, extractPath } from '../src/algorithms/floodfill.js';

test('bfs - distances on a small grid with walls', () => {
  // 3x3 grid:
  // (0,0) (1,0) (2,0)
  // (0,1) [WALL] (2,1)
  // (0,2) (1,2) (2,2)
  const w = 3, h = 3;
  const wallIndex = 1 * w + 1; // (1, 1)
  const passable = (i) => i !== wallIndex;

  const res = bfs(w, h, [0], passable); // start at (0,0)
  assert.equal(res.dist[0], 0);
  assert.equal(res.dist[1 * w + 0], 1); // (0,1)
  assert.equal(res.dist[0 * w + 1], 1); // (1,0)
  assert.equal(res.dist[wallIndex], -1); // Wall cannot be reached
  // (2,0) can be reached via (1,0) -> dist = 2
  assert.equal(res.dist[0 * w + 2], 2);
  // (2,2) can be reached via (0,2)->(1,2)->(2,2) or (2,0)->(2,1)->(2,2) -> dist = 4
  assert.equal(res.dist[2 * w + 2], 4);
});

test('bfs - maxDepth cut-off', () => {
  const w = 10, h = 1;
  const passable = () => true;
  const res = bfs(w, h, [0], passable, { maxDepth: 3 });

  assert.equal(res.dist[0], 0);
  assert.equal(res.dist[1], 1);
  assert.equal(res.dist[2], 2);
  assert.equal(res.dist[3], 3);
  assert.equal(res.dist[4], -1); // beyond maxDepth cut-off
  assert.equal(res.dist[9], -1);
});

test('bfs - multi-source', () => {
  const w = 5, h = 1;
  const passable = () => true;
  // Two sources at both ends: cell 0 and cell 4
  const res = bfs(w, h, [0, 4], passable);

  assert.equal(res.dist[0], 0);
  assert.equal(res.dist[1], 1);
  assert.equal(res.dist[2], 2);
  assert.equal(res.dist[3], 1);
  assert.equal(res.dist[4], 0);
});

test('labelRegions - counts components correctly', () => {
  // 5x5 grid with two disconnected danger areas:
  // D D . . .
  // D . . . .
  // . . . . .
  // . . . D D
  // . . . D D
  const w = 5, h = 5;
  const dangerCells = new Set([
    0 * w + 0, 0 * w + 1, 1 * w + 0, // Component 1: 3 cells
    3 * w + 3, 3 * w + 4, 4 * w + 3, 4 * w + 4 // Component 2: 4 cells
  ]);
  const isDanger = (i) => dangerCells.has(i);

  const res = labelRegions(w, h, isDanger);
  assert.equal(res.count, 2);
  assert.deepEqual(res.sizes.slice().sort(), [3, 4]);
  assert.equal(res.largest, 4);

  // Danger cells must have non-negative labels
  for (const c of dangerCells) {
    assert.ok(res.labels[c] >= 0);
  }
  // Non-danger cells must have label -1
  assert.equal(res.labels[2 * w + 2], -1);
});

test('FloodFillStepper - finishes and matches bfs distances', () => {
  const w = 4, h = 4;
  const wall = new Set([1 * w + 1, 1 * w + 2]);
  const passable = (i) => !wall.has(i);

  const bfsRes = bfs(w, h, [0], passable);

  const stepper = new FloodFillStepper(w, h, [0], passable);
  let guard = 0;
  while (!stepper.done && guard++ < 50) {
    stepper.step();
  }

  assert.equal(stepper.done, true);
  for (let i = 0; i < w * h; i++) {
    assert.equal(stepper.dist[i], bfsRes.dist[i], `Mismatch at cell ${i}`);
  }
});
