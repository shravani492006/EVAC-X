import { useEffect, useRef } from 'react';
import { Simulation } from '../engine/Simulation.js';
import { Renderer } from '../engine/Renderer.js';

export default function LevelThumb({ level }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const r = new Renderer(c); const sim = new Simulation(level); sim.visualTime = 5;
    r.render(sim, { showPaths: false });
  }, [level]);
  return <canvas ref={ref} className="thumb" aria-label={`${level.title} map preview`} />;
}
