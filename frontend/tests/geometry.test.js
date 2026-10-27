import test from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentIntersection,
  pointInRect,
  rectVsRect,
  circleVsRect,
  segmentVsRect,
  hasLineOfSight,
  resetCollisionStats,
  collisionStats
} from '../src/algorithms/geometry.js';

test('segmentIntersection - crossing, parallel, touching endpoint', () => {
  resetCollisionStats();

  // 1. Crossing segments
  const cross = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
  assert.equal(cross.hit, true);
  assert.equal(cross.parallel, false);
  assert.ok(Math.abs(cross.x - 5) < 1e-6);
  assert.ok(Math.abs(cross.y - 5) < 1e-6);
  assert.ok(Math.abs(cross.t - 0.5) < 1e-6);
  assert.ok(Math.abs(cross.u - 0.5) < 1e-6);

  // 2. Parallel segments
  const parallel = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
  assert.equal(parallel.hit, false);
  assert.equal(parallel.parallel, true);

  // 3. Touching endpoint
  const touch = segmentIntersection({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 5 });
  assert.equal(touch.hit, true);
  assert.ok(Math.abs(touch.x - 5) < 1e-6);
  assert.ok(Math.abs(touch.y - 5) < 1e-6);

  // 4. Disjoint / non-intersecting
  const disjoint = segmentIntersection({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 5, y: 0 }, { x: 5, y: 10 });
  assert.equal(disjoint.hit, false);

  assert.ok(collisionStats.checks >= 4);
});

test('pointInRect - inside, on boundary, outside', () => {
  const rect = { x: 10, y: 10, w: 20, h: 20 };

  assert.equal(pointInRect({ x: 15, y: 15 }, rect), true);
  assert.equal(pointInRect({ x: 10, y: 10 }, rect), true);
  assert.equal(pointInRect({ x: 30, y: 30 }, rect), true);
  assert.equal(pointInRect({ x: 5, y: 15 }, rect), false);
  assert.equal(pointInRect({ x: 35, y: 15 }, rect), false);
});

test('rectVsRect - overlap vs disjoint', () => {
  const r1 = { x: 10, y: 10, w: 20, h: 20 };
  const r2 = { x: 20, y: 20, w: 20, h: 20 }; // overlapping
  const r3 = { x: 40, y: 40, w: 10, h: 10 }; // disjoint
  const r4 = { x: 30, y: 10, w: 10, h: 20 }; // adjacent edge (touching but non-overlapping)

  assert.equal(rectVsRect(r1, r2), true);
  assert.equal(rectVsRect(r1, r3), false);
  assert.equal(rectVsRect(r1, r4), false);
});

test('circleVsRect - circle vs rect collision detection', () => {
  const rect = { x: 10, y: 10, w: 20, h: 20 };

  // Circle inside rect
  assert.equal(circleVsRect({ x: 15, y: 15, r: 2 }, rect), true);

  // Circle touching / overlapping edge
  assert.equal(circleVsRect({ x: 8, y: 15, r: 3 }, rect), true);

  // Circle outside and clear
  assert.equal(circleVsRect({ x: 5, y: 15, r: 2 }, rect), false);

  // Circle overlapping near corner (corner distance check)
  // Distance from (6,6) to corner (10,10) is dx=4, dy=4, dist=sqrt(32) ≈ 5.657
  assert.equal(circleVsRect({ x: 6, y: 6, r: 5 }, rect), false);
  assert.equal(circleVsRect({ x: 6, y: 6, r: 6 }, rect), true);
});

test('segmentVsRect - endpoint inside, passing through, and outside', () => {
  const rect = { x: 10, y: 10, w: 20, h: 20 };

  // Endpoint inside
  assert.equal(segmentVsRect({ x: 15, y: 15 }, { x: 50, y: 50 }, rect), true);

  // Pierces through without endpoints inside
  assert.equal(segmentVsRect({ x: 0, y: 20 }, { x: 40, y: 20 }, rect), true);

  // Clear of rect
  assert.equal(segmentVsRect({ x: 0, y: 0 }, { x: 5, y: 5 }, rect), false);
});

test('hasLineOfSight - true when unobstructed, false when wall intersects', () => {
  const wall = { a: { x: 10, y: 0 }, b: { x: 10, y: 20 } };

  // Line of sight blocked by wall
  assert.equal(hasLineOfSight({ x: 0, y: 10 }, { x: 20, y: 10 }, [wall]), false);

  // Line of sight clear
  assert.equal(hasLineOfSight({ x: 0, y: 25 }, { x: 20, y: 25 }, [wall]), true);
});
