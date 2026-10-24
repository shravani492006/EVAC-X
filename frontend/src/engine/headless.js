import { Simulation } from './Simulation.js';

/** Runs a full level without rendering. Used by the What-If analysis. dt is coarser than live play for speed. */
export function runHeadlessSync(level, mods = {}, dt = 0.1) {
  const sim = new Simulation(level, { headless: true, mods });
  sim.start();
  let guard = 0;
  while (sim.status === 'RUNNING' && guard++ < 20000) sim.step(dt);
  return sim.result || (sim._finish(), sim.result);
}

export async function runHeadless(level, mods = {}, onProgress, dt = 0.1) {
  const sim = new Simulation(level, { headless: true, mods });
  sim.start();
  let guard = 0;
  while (sim.status === 'RUNNING' && guard < 20000) {
    for (let k = 0; k < 30 && sim.status === 'RUNNING'; k++, guard++) sim.step(dt);
    if (onProgress) onProgress(1 - sim.timeLeft / level.time);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!sim.result) sim._finish();
  return sim.result;
}
