import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/engine/Simulation.js';
import { runHeadlessSync } from '../src/engine/headless.js';
import { LEVELS } from '../src/data/levels.js';
import { CELL, GRID_W as W } from '../src/game/constants.js';

test('Simulation - determinism: running the same level twice gives identical results', () => {
  const level = LEVELS[0]; // Training facility
  const r1 = runHeadlessSync(level);
  const r2 = runHeadlessSync(level);

  delete r1.algo.astar.ms;
  delete r2.algo.astar.ms;

  assert.deepEqual(r1, r2);
});

test('Simulation - all 4 levels finish and satisfy conservation of people', () => {
  for (const level of LEVELS) {
    const res = runHeadlessSync(level);
    assert.ok(res, `Result should exist for level ${level.id}`);
    assert.ok(['COMPLETE', 'FAILED'].includes(res.outcome));
    assert.equal(
      res.peopleSaved + res.peopleLost + res.peopleRemaining,
      res.peopleTotal,
      `People count mismatch on level ${level.id}`
    );
  }
});

test('Simulation tools - applyTool block refuses on wall, exit, and occupied cell', () => {
  const level = LEVELS[0];
  const sim = new Simulation(level, { headless: true });
  sim.start();

  // (0,0) is a wall in Training facility
  assert.equal(sim.building.grid[0], CELL.WALL);
  const wallRes = sim.applyTool('block', 0, 0);
  assert.equal(wallRes.ok, false);
  assert.equal(wallRes.msg, 'Cannot block here');

  // Exit cell
  const exit0 = sim.building.exits[0];
  const exX = exit0.cell % W;
  const exY = Math.floor(exit0.cell / W);
  const exitRes = sim.applyTool('block', exX, exY);
  assert.equal(exitRes.ok, false);
  assert.equal(exitRes.msg, 'Cannot block here');

  // Occupied cell
  const person = sim.persons[0];
  const pX = person.currentCell % W;
  const pY = Math.floor(person.currentCell / W);
  sim._updateOccupancy();
  const occRes = sim.applyTool('block', pX, pY);
  assert.equal(occRes.ok, false);
  assert.equal(occRes.msg, 'Cell occupied');
});

test('Simulation tools - setExitOpen refuses to open a burning exit', () => {
  const level = LEVELS[0];
  const sim = new Simulation(level, { headless: true });
  sim.start();

  const exit0 = sim.building.exits[0];
  exit0.burning = true;

  const res = sim.setExitOpen(0, true);
  assert.equal(res.ok, false);
  assert.equal(res.msg, 'EXIT 1 is on fire');
});

test('Simulation tools - extinguish consumes suppression charge and refuses at 0', () => {
  const level = LEVELS[0];
  const sim = new Simulation(level, { headless: true });
  sim.start();

  // Find a walkable corridor cell to ignite and extinguish
  const cx = 10, cy = 14;
  sim.applyTool('fire', cx, cy);

  const initialSuppression = sim.suppression;
  assert.ok(initialSuppression >= 1);

  const extRes = sim.applyTool('extinguish', cx, cy);
  assert.equal(extRes.ok, true);
  assert.equal(sim.suppression, initialSuppression - 1);

  // When suppression is 0
  sim.suppression = 0;
  // Ignite again
  sim.applyTool('fire', cx, cy);
  const extZero = sim.applyTool('extinguish', cx, cy);
  assert.equal(extZero.ok, false);
  assert.equal(extZero.msg, 'Suppression recharging…');
});

test('Simulation mods - closed exit is never used when mods.closeExit is set', () => {
  const level = LEVELS[0];
  const closedIndex = 0;
  const res = runHeadlessSync(level, { closeExit: closedIndex });

  assert.equal(res.exitUsage[closedIndex], 0);
});
