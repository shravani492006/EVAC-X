import test from 'node:test';
import assert from 'node:assert/strict';
import { liangBarsky, ClipStats, clipPolyline } from '../src/algorithms/clipping.js';

test('liangBarsky - fully inside', () => {
  const res = liangBarsky(20, 20, 30, 30, 10, 10, 50, 50);
  assert.equal(res.accepted, true);
  assert.equal(res.clipped, false);
  assert.equal(res.t0, 0);
  assert.equal(res.t1, 1);
  assert.equal(res.x0, 20);
  assert.equal(res.y0, 20);
  assert.equal(res.x1, 30);
  assert.equal(res.y1, 30);
});

test('liangBarsky - fully outside', () => {
  const res = liangBarsky(0, 20, 5, 20, 10, 10, 50, 50);
  assert.equal(res.accepted, false);
  assert.equal(res.clipped, true);
});

test('liangBarsky - crossing one edge', () => {
  // Enters left edge at x=10
  const res = liangBarsky(0, 20, 30, 20, 10, 10, 50, 50);
  assert.equal(res.accepted, true);
  assert.equal(res.clipped, true);
  assert.ok(Math.abs(res.t0 - 1 / 3) < 1e-6);
  assert.equal(res.t1, 1);
  assert.ok(Math.abs(res.x0 - 10) < 1e-6);
  assert.equal(res.y0, 20);
  assert.equal(res.x1, 30);
  assert.equal(res.y1, 20);
});

test('liangBarsky - crossing two edges', () => {
  // Crosses left at x=10 and right at x=50
  const res = liangBarsky(0, 20, 60, 20, 10, 10, 50, 50);
  assert.equal(res.accepted, true);
  assert.equal(res.clipped, true);
  assert.ok(Math.abs(res.t0 - 10 / 60) < 1e-6);
  assert.ok(Math.abs(res.t1 - 50 / 60) < 1e-6);
  assert.ok(Math.abs(res.x0 - 10) < 1e-6);
  assert.equal(res.y0, 20);
  assert.ok(Math.abs(res.x1 - 50) < 1e-6);
  assert.equal(res.y1, 20);
});

test('liangBarsky - parallel-outside rejection', () => {
  // Vertical line at x=5, entirely to the left of xmin=10
  const res = liangBarsky(5, 0, 5, 60, 10, 10, 50, 50);
  assert.equal(res.accepted, false);
  assert.equal(res.clipped, true);
});

test('liangBarsky - diagonal through corner', () => {
  // Diagonal line from (-5, -5) to (15, 15) through window [0,0] to [10,10]
  const res = liangBarsky(-5, -5, 15, 15, 0, 0, 10, 10);
  assert.equal(res.accepted, true);
  assert.equal(res.clipped, true);
  assert.ok(Math.abs(res.t0 - 0.25) < 1e-6);
  assert.ok(Math.abs(res.t1 - 0.75) < 1e-6);
  assert.ok(Math.abs(res.x0 - 0) < 1e-6);
  assert.ok(Math.abs(res.y0 - 0) < 1e-6);
  assert.ok(Math.abs(res.x1 - 10) < 1e-6);
  assert.ok(Math.abs(res.y1 - 10) < 1e-6);
});

test('clipPolyline & ClipStats - records correctly', () => {
  const stats = new ClipStats();
  const rect = { xmin: 0, ymin: 0, xmax: 10, ymax: 10 };
  const points = [
    { x: -5, y: 5 },
    { x: 5, y: 5 },
    { x: 15, y: 5 }
  ];
  const segments = clipPolyline(points, rect, stats);
  assert.equal(segments.length, 2);
  assert.equal(stats.tested, 2);
  assert.equal(stats.visible, 2);
  assert.equal(stats.clipped, 2);
});
