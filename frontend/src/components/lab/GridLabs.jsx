import { useEffect, useRef, useState } from 'react';
import { Play, Pause, StepForward, RotateCcw, Shuffle, Eraser } from 'lucide-react';
import { PathGrid, AStarSearch } from '../../algorithms/astar.js';
import { FloodFillStepper, extractPath } from '../../algorithms/floodfill.js';
import { cp, useTick, InfoPanel, Rows, Legend } from './labCommon.jsx';

const GW = 32, GH = 20, SZ = 24;
const sampleWalls = () => { const w = new Uint8Array(GW * GH); for (let y = 3; y < 17; y++) w[y * GW + 14] = 1; for (let x = 6; x < 14; x++) w[10 * GW + x] = 1; for (let y = 0; y < 8; y++) w[y * GW + 22] = 1; return w; };
const randomWalls = (start, goal) => { const w = new Uint8Array(GW * GH); for (let i = 0; i < w.length; i++) if (Math.random() < 0.27 && i !== start && i !== goal) w[i] = 1; return w; };

function drawBase(ctx, walls, start, goal, hover) {
  ctx.fillStyle = '#060b17'; ctx.fillRect(0, 0, GW * SZ, GH * SZ);
  for (let i = 0; i < walls.length; i++) {
    const x = (i % GW) * SZ, y = ((i / GW) | 0) * SZ;
    ctx.fillStyle = walls[i] ? '#3a4f7a' : (((i % GW) + ((i / GW) | 0)) % 2 ? '#0d1830' : '#0b1429'); ctx.fillRect(x, y, SZ, SZ);
  }
  ctx.strokeStyle = 'rgba(120,170,255,0.08)'; ctx.beginPath();
  for (let x = 0; x <= GW; x++) { ctx.moveTo(x * SZ, 0); ctx.lineTo(x * SZ, GH * SZ); } for (let y = 0; y <= GH; y++) { ctx.moveTo(0, y * SZ); ctx.lineTo(GW * SZ, y * SZ); } ctx.stroke();
  void hover; void start; void goal;
}
function marker(ctx, i, color, label) {
  const x = (i % GW) * SZ, y = ((i / GW) | 0) * SZ;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + SZ / 2, y + SZ / 2, SZ * 0.38, 0, 7); ctx.fill();
  ctx.fillStyle = '#04101e'; ctx.font = '700 12px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + SZ / 2, y + SZ / 2 + 1);
}
function Toolbar({ tool, setTool, tools }) {
  return <>{tools.map(([id, label]) => <button key={id} className={`btn sm ${tool === id ? 'active' : ''}`} onClick={() => setTool(id)}>{label}</button>)}</>;
}

/* ───────────────────────── A* ───────────────────────── */
export function AStarLab() {
  const canvasRef = useRef(null), tick = useTick();
  const S = useRef(null);
  if (!S.current) S.current = { grid: new PathGrid(GW, GH), walls: sampleWalls(), start: 10 * GW + 3, goal: 9 * GW + 27, search: null, hover: -1 };
  const s = S.current;
  const [tool, setTool] = useState('wall'), [heur, setHeur] = useState('manhattan'), [diag, setDiag] = useState(false), [running, setRunning] = useState(false);

  const ensure = () => {
    if (s.search) return;
    s.grid.nodes.forEach((n, i) => { n.walkable = !s.walls[i]; n.cost = 0; });
    s.search = new AStarSearch(s.grid, { x: s.start % GW, y: (s.start / GW) | 0 }, [{ x: s.goal % GW, y: (s.goal / GW) | 0 }], { heuristic: heur, diagonal: diag });
  };
  const reset = () => { s.search = null; setRunning(false); tick(); };
  const step = () => { ensure(); s.search.step(); tick(); };
  useEffect(() => { reset(); }, [heur, diag]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => { ensure(); s.search.step(); if (s.search.done) setRunning(false); tick(); }, 60);
    return () => clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    drawBase(ctx, s.walls);
    const q = s.search;
    if (q) {
      const path = q.found ? new Set(q.path().map((n) => n.id)) : new Set();
      for (const n of q.touched()) {
        const x = n.x * SZ, y = n.y * SZ;
        ctx.fillStyle = path.has(n.id) ? 'rgba(34,211,238,0.75)' : n.closed ? 'rgba(59,130,246,0.38)' : 'rgba(52,211,153,0.42)'; ctx.fillRect(x + 1, y + 1, SZ - 2, SZ - 2);
        if (n.g !== Infinity) { ctx.fillStyle = '#dce8ff'; ctx.font = '600 9px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.round(n.f), x + SZ / 2, y + SZ / 2); }
      }
      if (q.current && !q.found) { ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.strokeRect(q.current.x * SZ + 1.5, q.current.y * SZ + 1.5, SZ - 3, SZ - 3); ctx.lineWidth = 1; }
    }
    marker(ctx, s.start, '#34d399', 'S'); marker(ctx, s.goal, '#ff5a1f', 'G');
    if (s.hover >= 0) { ctx.strokeStyle = '#fff'; ctx.strokeRect((s.hover % GW) * SZ, ((s.hover / GW) | 0) * SZ, SZ, SZ); }
  });

  const edit = (e, down) => {
    const p = cp(e, canvasRef.current), i = Math.floor(p.y / SZ) * GW + Math.floor(p.x / SZ);
    if (i < 0 || i >= GW * GH) return;
    s.hover = i;
    if (!(e.buttons & 1) && !down) { tick(); return; }
    if (tool === 'wall' && i !== s.start && i !== s.goal) s.walls[i] = 1;
    else if (tool === 'erase') s.walls[i] = 0;
    else if (tool === 'start' && !s.walls[i] && i !== s.goal) s.start = i;
    else if (tool === 'goal' && !s.walls[i] && i !== s.start) s.goal = i;
    s.search = null; tick();
  };
  const q = s.search, snap = q ? q.snapshot() : null, hn = s.hover >= 0 && q && s.grid.nodes[s.hover].runId === q.runId ? s.grid.nodes[s.hover] : null;
  const open = q ? q.touched().filter((n) => n.open).sort((a, b) => a.f - b.f).slice(0, 5) : [];
  return (
    <div className="lab">
      <div>
        <canvas ref={canvasRef} width={GW * SZ} height={GH * SZ} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); edit(e, true); }} onPointerMove={(e) => edit(e, false)} onPointerLeave={() => { s.hover = -1; tick(); }} />
        <div className="controls">
          <button className="btn sm primary" onClick={() => setRunning((r) => !r)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'PAUSE' : 'RUN'}</button>
          <button className="btn sm" onClick={step}><StepForward size={14} />STEP</button>
          <button className="btn sm" onClick={reset}><RotateCcw size={14} />RESET</button>
          <button className="btn sm" onClick={() => { s.walls = randomWalls(s.start, s.goal); reset(); }}><Shuffle size={14} />RANDOM</button>
          <button className="btn sm" onClick={() => { s.walls = new Uint8Array(GW * GH); reset(); }}><Eraser size={14} />CLEAR</button>
        </div>
        <div className="controls">
          <Toolbar tool={tool} setTool={setTool} tools={[['wall', 'Draw wall'], ['erase', 'Erase'], ['start', 'Set start'], ['goal', 'Set goal']]} />
          <label>Heuristic <select value={heur} onChange={(e) => setHeur(e.target.value)}>{['manhattan', 'euclidean', 'chebyshev', 'octile'].map((h) => <option key={h}>{h}</option>)}</select></label>
          <label><input type="checkbox" checked={diag} onChange={(e) => setDiag(e.target.checked)} />8-direction</label>
        </div>
        <Legend items={[['#34d399', 'Open set'], ['#3b82f6', 'Closed set'], ['#fbbf24', 'Current node'], ['#22d3ee', 'Final path'], ['#3a4f7a', 'Wall']]} />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Numbers inside cells are f(n). Hover a cell for g, h, f.</p>
      </div>
      <div className="lab-side">
        <InfoPanel id="astar" />
        <div className="panel"><h3>Statistics</h3>
          <Rows rows={[['Status', snap ? (snap.done ? (snap.found ? 'PATH FOUND' : 'NO PATH') : 'SEARCHING') : 'READY'], ['Current node', snap?.currentNode ?? '—'], ['Open set', snap?.open ?? 0], ['Closed set', snap?.closed ?? 0], ['Nodes expanded', snap?.expanded ?? 0], ['g(n)', snap?.g ?? 0], ['h(n)', snap?.h ?? 0], ['f(n)', snap?.f ?? 0], ['Path length', snap?.pathLength ?? 0]]} />
        </div>
        <div className="panel"><h3>Hover node</h3>{hn ? <Rows rows={[['Node', `N${hn.id} (${hn.x},${hn.y})`], ['g', hn.g === Infinity ? '∞' : hn.g.toFixed(1)], ['h', hn.h.toFixed(1)], ['f', hn.f.toFixed(1)], ['State', hn.closed ? 'closed' : hn.open ? 'open' : '—']]} /> : <p>Hover an explored cell.</p>}
          {open.length > 0 && <><p style={{ marginTop: 8 }}><b>Next in OPEN (lowest f):</b></p><table className="mini-tbl"><thead><tr><th>node</th><th>g</th><th>h</th><th>f</th></tr></thead><tbody>{open.map((n) => <tr key={n.id}><td>N{n.id}</td><td>{n.g.toFixed(1)}</td><td>{n.h.toFixed(1)}</td><td>{n.f.toFixed(1)}</td></tr>)}</tbody></table></>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Flood fill + BFS ───────────────────────── */
export function FloodLab({ mode }) {
  const canvasRef = useRef(null), tick = useTick();
  const S = useRef(null);
  if (!S.current) S.current = { walls: sampleWalls(), start: 10 * GW + 4, goal: 9 * GW + 27, fill: null };
  const s = S.current;
  const [tool, setTool] = useState('wall'), [running, setRunning] = useState(false);
  const bfsMode = mode === 'bfs';
  const ensure = () => { if (!s.fill) s.fill = new FloodFillStepper(GW, GH, [s.start], (i) => !s.walls[i], bfsMode ? s.goal : -1); };
  const reset = () => { s.fill = null; setRunning(false); tick(); };
  const step = () => { ensure(); s.fill.step(); tick(); };
  useEffect(() => { reset(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => { ensure(); s.fill.step(); if (s.fill.done) setRunning(false); tick(); }, 110);
    return () => clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'); drawBase(ctx, s.walls);
    const f = s.fill;
    if (f) {
      const path = bfsMode && f.found ? new Set(extractPath(f.parent, s.goal)) : null;
      const front = new Set(f.frontier);
      for (let i = 0; i < f.dist.length; i++) {
        if (f.dist[i] < 0) continue;
        const x = (i % GW) * SZ, y = ((i / GW) | 0) * SZ;
        ctx.fillStyle = path && path.has(i) ? 'rgba(251,191,36,0.9)' : front.has(i) ? 'rgba(255,255,255,0.55)' : `hsla(${190 + f.dist[i] * 5},80%,52%,0.45)`; ctx.fillRect(x + 1, y + 1, SZ - 2, SZ - 2);
        if (SZ >= 22) { ctx.fillStyle = '#e8f1ff'; ctx.font = '500 8px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.dist[i], x + SZ / 2, y + SZ / 2); }
      }
    }
    marker(ctx, s.start, '#34d399', 'S'); if (bfsMode) marker(ctx, s.goal, '#ff5a1f', 'G');
  });
  const edit = (e) => {
    if (!(e.buttons & 1)) return;
    const p = cp(e, canvasRef.current), i = Math.floor(p.y / SZ) * GW + Math.floor(p.x / SZ);
    if (i < 0 || i >= GW * GH) return;
    if (tool === 'wall' && i !== s.start && i !== s.goal) s.walls[i] = 1; else if (tool === 'erase') s.walls[i] = 0;
    else if (tool === 'start' && !s.walls[i]) s.start = i; else if (tool === 'goal' && !s.walls[i]) s.goal = i;
    s.fill = null; tick();
  };
  const f = s.fill;
  return (
    <div className="lab">
      <div>
        <canvas ref={canvasRef} width={GW * SZ} height={GH * SZ} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); edit(e); }} onPointerMove={edit} />
        <div className="controls">
          <button className="btn sm primary" onClick={() => setRunning((r) => !r)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'PAUSE' : 'RUN'}</button>
          <button className="btn sm" onClick={step}><StepForward size={14} />NEXT WAVE</button>
          <button className="btn sm" onClick={reset}><RotateCcw size={14} />RESET</button>
          <button className="btn sm" onClick={() => { s.walls = randomWalls(s.start, s.goal); reset(); }}><Shuffle size={14} />RANDOM</button>
        </div>
        <div className="controls"><Toolbar tool={tool} setTool={setTool} tools={[['wall', 'Draw wall'], ['erase', 'Erase'], ['start', bfsMode ? 'Set start' : 'Set seed'], ...(bfsMode ? [['goal', 'Set goal']] : [])]} /></div>
        <Legend items={[['hsl(200,80%,52%)', 'Wave distance (number)'], ['rgba(255,255,255,0.7)', 'Current frontier'], ...(bfsMode ? [['#fbbf24', 'Shortest path']] : [])]} />
      </div>
      <div className="lab-side">
        <InfoPanel id={mode} />
        <div className="panel"><h3>Statistics</h3>
          <Rows rows={[['Status', f ? (f.done ? (bfsMode ? (f.found ? 'GOAL REACHED' : 'GOAL UNREACHABLE') : 'REGION FILLED') : 'EXPANDING') : 'READY'], ['Waves (layers)', f?.layer ?? 0], ['Cells processed', f?.processed ?? 0], ['Cells affected', f?.affected ?? 0], ['Frontier size', f?.frontier.length ?? 0], ...(bfsMode ? [['Path length', f && f.found ? extractPath(f.parent, s.goal).length - 1 : 0]] : [])]} />
        </div>
      </div>
    </div>
  );
}
