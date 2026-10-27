import test from 'node:test';
import assert from 'node:assert/strict';
import { Mat3, transformPoints, degToRad } from '../src/algorithms/transform.js';

test('Mat3 - compose / inverse / apply round-trips', () => {
  const T = Mat3.translation(15, -25);
  const R = Mat3.rotation(degToRad(45));
  const S = Mat3.scaling(2, 3);

  const M = Mat3.compose(T, R, S);
  const inv = M.inverse();

  const originalPt = { x: 12.5, y: -7.2 };
  const transformed = M.apply(originalPt.x, originalPt.y);
  const roundTrip = inv.apply(transformed.x, transformed.y);

  assert.ok(Math.abs(roundTrip.x - originalPt.x) < 1e-6);
  assert.ok(Math.abs(roundTrip.y - originalPt.y) < 1e-6);
});

test('Mat3 - inverse() of T·R·S returns identity when composed', () => {
  const T = Mat3.translation(50, 80);
  const R = Mat3.rotation(degToRad(30));
  const S = Mat3.scaling(1.5, 0.8);

  const M = Mat3.compose(T, R, S);
  const inv = M.inverse();

  const product = M.multiply(inv);
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  for (let i = 0; i < 9; i++) {
    assert.ok(
      Math.abs(product.m[i] - identity[i]) < 1e-6,
      `Matrix element [${i}] was ${product.m[i]}, expected ${identity[i]}`
    );
  }
});

test('Mat3 - transformPoints correctly maps arrays and objects', () => {
  const M = Mat3.translation(10, 20);
  const ptsObj = [{ x: 1, y: 2 }, { x: 5, y: 7 }];
  const ptsArr = [[1, 2], [5, 7]];

  const outObj = transformPoints(M, ptsObj);
  const outArr = transformPoints(M, ptsArr);

  assert.deepEqual(outObj, [{ x: 11, y: 22 }, { x: 15, y: 27 }]);
  assert.deepEqual(outArr, [{ x: 11, y: 22 }, { x: 15, y: 27 }]);
});

test('Mat3 - decompose recovers translation, rotation, and scale', () => {
  const tx = 42, ty = -17, angle = degToRad(60), scale = 2.5;
  const M = Mat3.compose(
    Mat3.translation(tx, ty),
    Mat3.rotation(angle),
    Mat3.scaling(scale, scale)
  );

  const d = M.decompose();
  assert.ok(Math.abs(d.tx - tx) < 1e-6);
  assert.ok(Math.abs(d.ty - ty) < 1e-6);
  assert.ok(Math.abs(d.rotation - angle) < 1e-6);
  assert.ok(Math.abs(d.sx - scale) < 1e-6);
  assert.ok(Math.abs(d.sy - scale) < 1e-6);
});
