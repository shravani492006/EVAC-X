import { Simulation, STEP } from './Simulation.js';

/** Runs a full level without rendering. Used by the What-If analysis. dt defaults to STEP for exact fidelity with live play. */
export function runHeadlessSync(level, mods = {}, dt = STEP) {
  const sim = new Simulation(level, { headless: true, mods });
  sim.start();
  let guard = 0;
  while (sim.status === 'RUNNING' && guard++ < 40000) sim.step(dt);
  return sim.result || (sim._finish(), sim.result);
}

export async function runHeadless(level, mods = {}, onProgress, dt = STEP) {
  const sim = new Simulation(level, { headless: true, mods });
  sim.start();
  let guard = 0;
  while (sim.status === 'RUNNING' && guard < 40000) {
    for (let k = 0; k < 60 && sim.status === 'RUNNING'; k++, guard++) sim.step(dt);
    if (onProgress) onProgress(1 - sim.timeLeft / level.time);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!sim.result) sim._finish();
  return sim.result;
}

