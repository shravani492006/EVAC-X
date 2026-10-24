import { useEffect, useRef } from 'react';
import { Simulation } from '../engine/Simulation.js';
import { Renderer } from '../engine/Renderer.js';
import { LEVELS } from '../data/levels.js';

/** The landing hero is a real, running simulation rendered with the same engine as the game. */
export default function LiveBackdrop({ levelIndex = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return undefined;
    const r = new Renderer(canvas);
    let sim = new Simulation(LEVELS[levelIndex]); sim.start(); sim.setSpeed(2);
    let raf, last = performance.now(), idle = 0;
    const ro = new ResizeObserver(() => r.resize()); ro.observe(canvas);
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      sim.update(dt);
      if (sim.status === 'ENDED' && (idle += dt) > 3) { sim = new Simulation(LEVELS[levelIndex]); sim.start(); sim.setSpeed(2); idle = 0; }
      r.render(sim, { showPaths: true, showHeat: true });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [levelIndex]);
  return <canvas ref={ref} className="backdrop" aria-hidden="true" />;
}
