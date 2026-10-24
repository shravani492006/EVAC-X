import { useEffect, useRef } from 'react';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { Renderer } from '../engine/Renderer.js';
import { sound } from '../engine/audio.js';
import { segmentIntersection } from '../algorithms/geometry.js';
import { CELL_SIZE as CS } from '../game/constants.js';

export const TOOL_COLORS = { select: '#22d3ee', fire: '#ff5a1f', extinguish: '#22d3ee', block: '#ffb020', unblock: '#34d399', openExit: '#34d399', closeExit: '#ff4d6d', pan: '#8ea3c7' };
const PAINT = new Set(['fire', 'block', 'unblock']);

/** Line-of-sight inspector data: segment A = person→exit, B = first wall segment crossing it (if any). */
function losInfo(sim, id) {
  const p = sim.persons.find((q) => q.id === id) || sim.persons.find((q) => !q.done);
  if (!p) return null;
  const exits = sim.building.exits.filter((e) => e.isOpen);
  if (!exits.length) return null;
  let ex = exits[0], bd = Infinity;
  for (const e of exits) { const d = Math.abs(e.position.x - p.position.x) + Math.abs(e.position.y - p.position.y); if (d < bd) { bd = d; ex = e; } }
  const A1 = { x: p.position.x, y: p.position.y }, A2 = ex.position;
  let best = null;
  for (const w of sim.building.wallSegments) { const r = segmentIntersection(A1, A2, w.a, w.b); if (r.hit && (!best || r.t < best.r.t)) best = { w, r }; }
  return { person: p.id, exit: ex.id, a: [A1, A2], b: best ? [best.w.a, best.w.b] : null, hit: !!best, x: best ? best.r.x : null, y: best ? best.r.y : null };
}

export default function GameCanvas({ sim, uiState, rendererRef, onSelect, onMessage, onFrame, children, className = '' }) {
  const canvasRef = useRef(null);
  const live = useRef(uiState); live.current = uiState;
  const cb = useRef({ onSelect, onMessage, onFrame }); cb.current = { onSelect, onMessage, onFrame };

  useEffect(() => {
    const canvas = canvasRef.current;
    const r = new Renderer(canvas); if (rendererRef) rendererRef.current = r;
    const ro = new ResizeObserver(() => r.resize()); ro.observe(canvas);
    let raf, last = performance.now(), lastSnap = 0, hover = null, pan = null, painting = false, lastCell = -1;

    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      sim.update(dt);
      while (sim.soundQueue.length) sound.play(sim.soundQueue.shift());
      const ui = live.current;
      r.render(sim, { ...ui, hover, toolColor: TOOL_COLORS[ui.tool] });
      if (now - lastSnap > 150) {
        lastSnap = now;
        const snap = sim.snapshot(ui.selectedId);
        snap.los = losInfo(sim, snap.selectedId);
        snap.cam = { zoom: r.cam.zoom, rows: r.matrix().rows(3) };
        cb.current.onFrame(snap);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const local = (e) => { const b = canvas.getBoundingClientRect(); return { px: e.clientX - b.left, py: e.clientY - b.top }; };
    const act = (w) => {
      const cx = Math.floor(w.x / CS), cy = Math.floor(w.y / CS), tool = live.current.tool;
      const res = sim.applyTool(tool, cx, cy, w.x, w.y);
      if (res.msg) cb.current.onMessage(res.msg, res.ok);
      if (res.ok) sound.play('click');
    };
    const down = (e) => {
      canvas.setPointerCapture(e.pointerId);
      const { px, py } = local(e), tool = live.current.tool;
      if (e.button === 1 || e.button === 2 || tool === 'pan') { pan = { x: e.clientX, y: e.clientY }; return; }
      const w = r.screenToWorld(px, py);
      if (tool === 'select') { const p = r.pick(sim, w.x, w.y); cb.current.onSelect(p ? p.id : null); return; }
      act(w); painting = PAINT.has(tool); lastCell = Math.floor(w.y / CS) * 100 + Math.floor(w.x / CS);
    };
    const move = (e) => {
      const { px, py } = local(e), w = r.screenToWorld(px, py);
      hover = { cx: Math.floor(w.x / CS), cy: Math.floor(w.y / CS) };
      if (pan) { r.panBy(e.clientX - pan.x, e.clientY - pan.y); pan = { x: e.clientX, y: e.clientY }; return; }
      if (painting) { const key = hover.cy * 100 + hover.cx; if (key !== lastCell) { lastCell = key; act(w); } }
    };
    const up = () => { pan = null; painting = false; };
    const leave = () => { hover = null; };
    const wheel = (e) => { e.preventDefault(); const { px, py } = local(e); r.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, px, py); };
    const ctx = (e) => e.preventDefault();
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('contextmenu', ctx);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', ctx);
    };
  }, [sim, rendererRef]);

  const zoom = (f) => { const r = rendererRef.current; if (r) r.zoomAt(f, r.cssW / 2, r.cssH / 2); };
  return (
    <div className={`canvas-wrap t-${uiState.tool} ${className}`}>
      <canvas ref={canvasRef} aria-label="Evacuation simulation canvas" />
      {children}
      <div className="canvas-overlay cam-ctl">
        <button className="btn" onClick={() => zoom(1.3)} aria-label="Zoom in"><Plus size={16} /></button>
        <button className="btn" onClick={() => zoom(1 / 1.3)} aria-label="Zoom out"><Minus size={16} /></button>
        <button className="btn" onClick={() => rendererRef.current && rendererRef.current.resetView()} aria-label="Reset view"><Maximize2 size={15} /></button>
      </div>
    </div>
  );
}
