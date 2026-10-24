import { useEffect, useRef } from 'react';
import { Shuffle } from 'lucide-react';
import { liangBarsky, ClipStats } from '../../algorithms/clipping.js';
import { segmentIntersection, rectVsRect, circleVsRect, pointInRect, segmentVsRect, collisionStats, resetCollisionStats } from '../../algorithms/geometry.js';
import { cp, useTick, dist, segDist, InfoPanel, Rows, Legend } from './labCommon.jsx';

const W = 768, H = 480;
const f1 = (n) => (n == null ? '—' : Number(n).toFixed(1));

/* ───────────────────────── Liang–Barsky ───────────────────────── */
const SAMPLE_LINES = [[60, 80, 420, 260], [100, 400, 700, 60], [300, 40, 320, 440], [250, 200, 500, 300], [30, 250, 740, 250], [600, 60, 700, 420], [120, 330, 200, 420], [280, 170, 520, 150]].map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 }));

export function LiangBarskyLab() {
  const ref = useRef(null), tick = useTick();
  const S = useRef({ win: { x0: 230, y0: 140, x1: 540, y1: 340 }, lines: SAMPLE_LINES.map((l) => ({ ...l })), sel: 0, drag: null });
  const s = S.current;
  const calc = () => {
    const xmin = Math.min(s.win.x0, s.win.x1), xmax = Math.max(s.win.x0, s.win.x1), ymin = Math.min(s.win.y0, s.win.y1), ymax = Math.max(s.win.y0, s.win.y1);
    const stats = new ClipStats();
    const res = s.lines.map((l, i) => { const r = liangBarsky(l.x0, l.y0, l.x1, l.y1, xmin, ymin, xmax, ymax, i === s.sel); stats.record(r); return r; });
    return { res, stats, rect: { xmin, ymin, xmax, ymax } };
  };
  const c = calc();
  useEffect(() => {
    const ctx = ref.current.getContext('2d'); ctx.fillStyle = '#060b17'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,170,255,0.06)'; ctx.beginPath(); for (let x = 0; x < W; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 0; y < H; y += 24) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
    const { xmin, ymin, xmax, ymax } = c.rect;
    ctx.fillStyle = 'rgba(34,211,238,0.07)'; ctx.fillRect(xmin, ymin, xmax - xmin, ymax - ymin); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5; ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
    s.lines.forEach((l, i) => {
      const r = c.res[i];
      ctx.strokeStyle = r.accepted ? 'rgba(142,163,199,0.45)' : 'rgba(255,77,109,0.55)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x1, l.y1); ctx.stroke(); ctx.setLineDash([]);
      if (r.accepted) { ctx.strokeStyle = i === s.sel ? '#fbbf24' : '#34d399'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x0, r.y0); ctx.lineTo(r.x1, r.y1); ctx.stroke(); }
      for (const [x, y] of [[l.x0, l.y0], [l.x1, l.y1]]) { ctx.fillStyle = i === s.sel ? '#fbbf24' : '#8ea3c7'; ctx.beginPath(); ctx.arc(x, y, i === s.sel ? 5 : 3.5, 0, 7); ctx.fill(); }
    });
    for (const [x, y] of [[s.win.x0, s.win.y0], [s.win.x1, s.win.y1]]) { ctx.fillStyle = '#22d3ee'; ctx.fillRect(x - 5, y - 5, 10, 10); }
  });
  const down = (e) => {
    const p = cp(e, ref.current); e.currentTarget.setPointerCapture(e.pointerId);
    if (dist(p, { x: s.win.x0, y: s.win.y0 }) < 12) s.drag = { k: 'w0' }; else if (dist(p, { x: s.win.x1, y: s.win.y1 }) < 12) s.drag = { k: 'w1' };
    else {
      s.drag = null;
      s.lines.forEach((l, i) => { if (dist(p, { x: l.x0, y: l.y0 }) < 11) { s.drag = { k: 'p0', i }; s.sel = i; } else if (dist(p, { x: l.x1, y: l.y1 }) < 11) { s.drag = { k: 'p1', i }; s.sel = i; } });
      if (!s.drag) { let b = -1, bd = 8; s.lines.forEach((l, i) => { const d = segDist(p, { x: l.x0, y: l.y0 }, { x: l.x1, y: l.y1 }); if (d < bd) { bd = d; b = i; } }); if (b >= 0) s.sel = b; }
    }
    tick();
  };
  const move = (e) => {
    if (!s.drag) return; const p = cp(e, ref.current), d = s.drag;
    if (d.k === 'w0') { s.win.x0 = p.x; s.win.y0 = p.y; } else if (d.k === 'w1') { s.win.x1 = p.x; s.win.y1 = p.y; }
    else if (d.k === 'p0') { s.lines[d.i].x0 = p.x; s.lines[d.i].y0 = p.y; } else { s.lines[d.i].x1 = p.x; s.lines[d.i].y1 = p.y; }
    tick();
  };
  const rnd = () => { s.lines = Array.from({ length: 8 }, () => ({ x0: Math.random() * W, y0: Math.random() * H, x1: Math.random() * W, y1: Math.random() * H })); s.sel = 0; tick(); };
  const sel = c.res[s.sel];
  return (
    <div className="lab">
      <div>
        <canvas ref={ref} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={() => { s.drag = null; }} />
        <div className="controls"><button className="btn sm" onClick={rnd}><Shuffle size={14} />RANDOM LINES</button><button className="btn sm" onClick={() => { s.lines = SAMPLE_LINES.map((l) => ({ ...l })); s.win = { x0: 230, y0: 140, x1: 540, y1: 340 }; tick(); }}>RESET</button></div>
        <Legend items={[['#34d399', 'Visible (clipped) segment'], ['#fbbf24', 'Selected line'], ['#ff4d6d', 'Rejected line'], ['#22d3ee', 'Clip window (drag corners)']]} />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Drag line endpoints or the two window corners. Click a line to select it.</p>
      </div>
      <div className="lab-side">
        <InfoPanel id="liang" />
        <div className="panel"><h3>Clipping engine</h3><Rows rows={[['Lines tested', c.stats.tested], ['Lines clipped', c.stats.clipped], ['Rejected', c.stats.rejected], ['Visible segments', c.stats.visible]]} /></div>
        <div className="panel"><h3>Line {s.sel + 1} — step by step</h3>
          <table className="mini-tbl"><thead><tr><th>edge</th><th>p</th><th>q</th><th>r=q/p</th></tr></thead><tbody>{sel.steps.map((st, i) => <tr key={i}><td>{st.edge}</td><td>{f1(st.p)}</td><td>{f1(st.q)}</td><td>{st.r == null ? '—' : st.r.toFixed(3)}</td></tr>)}</tbody></table>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--muted)' }}>{sel.steps.map((st, i) => <li key={i}>{st.edge}: {st.action}</li>)}</ul>
          <Rows rows={[['t0', sel.t0.toFixed(3)], ['t1', sel.t1.toFixed(3)], ['Result', sel.accepted ? `(${f1(sel.x0)},${f1(sel.y0)}) → (${f1(sel.x1)},${f1(sel.y1)})` : 'REJECTED']]} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Line intersection ───────────────────────── */
const WALLS = [[{ x: 380, y: 60 }, { x: 380, y: 260 }], [{ x: 150, y: 330 }, { x: 560, y: 330 }], [{ x: 560, y: 120 }, { x: 700, y: 240 }]];
export function LineIntersectLab() {
  const ref = useRef(null), tick = useTick();
  const S = useRef({ pts: [{ x: 120, y: 120 }, { x: 640, y: 380 }, { x: 160, y: 380 }, { x: 560, y: 90 }], drag: -1 });
  const s = S.current;
  const A = [s.pts[0], s.pts[1]], B = [s.pts[2], s.pts[3]];
  const ab = segmentIntersection(A[0], A[1], B[0], B[1]);
  const wallHits = WALLS.map((w) => segmentIntersection(A[0], A[1], w[0], w[1]));
  useEffect(() => {
    const ctx = ref.current.getContext('2d'); ctx.fillStyle = '#060b17'; ctx.fillRect(0, 0, W, H);
    const line = (a, b, col, w = 2) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    WALLS.forEach((w, i) => { line(w[0], w[1], wallHits[i].hit ? '#ff4d6d' : '#4b6aa3', 4); ctx.fillStyle = '#8ea3c7'; ctx.font = '11px "Chakra Petch"'; ctx.fillText(`WALL ${i + 1}`, (w[0].x + w[1].x) / 2 + 6, (w[0].y + w[1].y) / 2); });
    line(A[0], A[1], '#22d3ee', 2.5); line(B[0], B[1], '#a78bfa', 2.5);
    ctx.fillStyle = '#22d3ee'; ctx.font = '700 12px "Chakra Petch"'; ctx.fillText('A (sight line)', A[0].x + 8, A[0].y - 8); ctx.fillStyle = '#a78bfa'; ctx.fillText('B', B[0].x + 8, B[0].y - 8);
    const mark = (r, col) => { if (r.hit) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, 9, 0, 7); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r.x, r.y, 3.5, 0, 7); ctx.fill(); } };
    mark(ab, '#fbbf24'); wallHits.forEach((r) => mark(r, '#ff4d6d'));
    s.pts.forEach((p, i) => { ctx.fillStyle = i < 2 ? '#22d3ee' : '#a78bfa'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); });
  });
  const down = (e) => { const p = cp(e, ref.current); e.currentTarget.setPointerCapture(e.pointerId); s.drag = s.pts.findIndex((q) => dist(p, q) < 14); };
  const move = (e) => { if (s.drag < 0) return; const p = cp(e, ref.current); s.pts[s.drag] = { x: Math.max(0, Math.min(W, p.x)), y: Math.max(0, Math.min(H, p.y)) }; tick(); };
  const blocked = wallHits.findIndex((r) => r.hit);
  return (
    <div className="lab">
      <div>
        <canvas ref={ref} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={() => { s.drag = -1; }} />
        <Legend items={[['#22d3ee', 'Segment A (e.g. person → exit)'], ['#a78bfa', 'Segment B'], ['#4b6aa3', 'Wall'], ['#fbbf24', 'A ∩ B'], ['#ff4d6d', 'Wall hit — line of sight blocked']]} />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Drag the four end-points.</p>
      </div>
      <div className="lab-side">
        <InfoPanel id="intersect" />
        <div className="panel"><h3>Algorithm inspector</h3>
          <Rows rows={[['Segment A', `(${f1(A[0].x)},${f1(A[0].y)})→(${f1(A[1].x)},${f1(A[1].y)})`], ['Segment B', `(${f1(B[0].x)},${f1(B[0].y)})→(${f1(B[1].x)},${f1(B[1].y)})`], ['r × s', f1(ab.den)], ['t', ab.t == null ? 'parallel' : ab.t.toFixed(3)], ['u', ab.u == null ? 'parallel' : ab.u.toFixed(3)], ['Intersection', ab.hit ? 'YES' : 'NO'], ['Coordinates', ab.hit ? `(${f1(ab.x)}, ${f1(ab.y)})` : '—']]} />
        </div>
        <div className="panel"><h3>Visibility check (A vs walls)</h3>
          <Rows rows={[...WALLS.map((_, i) => [`Wall ${i + 1}`, wallHits[i].hit ? `HIT (${f1(wallHits[i].x)}, ${f1(wallHits[i].y)})` : 'clear']), ['Line of sight', blocked < 0 ? 'CLEAR' : `BLOCKED by wall ${blocked + 1}`]]} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Collision detection ───────────────────────── */
export function CollisionLab() {
  const ref = useRef(null), tick = useTick();
  const S = useRef({ rectA: { x: 120, y: 110, w: 170, h: 100 }, rectB: { x: 430, y: 220, w: 130, h: 90 }, circle: { x: 300, y: 340, r: 36 }, point: { x: 640, y: 110 }, seg: [{ x: 90, y: 420 }, { x: 330, y: 270 }], drag: null });
  const s = S.current;
  resetCollisionStats();
  const tests = [
    ['Rect A ∩ Rect B', rectVsRect(s.rectA, s.rectB)], ['Circle ∩ Rect A', circleVsRect(s.circle, s.rectA)], ['Circle ∩ Rect B', circleVsRect(s.circle, s.rectB)],
    ['Point ∈ Rect A', pointInRect(s.point, s.rectA)], ['Point ∈ Rect B', pointInRect(s.point, s.rectB)],
    ['Segment ∩ Rect A', segmentVsRect(s.seg[0], s.seg[1], s.rectA)], ['Segment ∩ Rect B', segmentVsRect(s.seg[0], s.seg[1], s.rectB)]
  ];
  const checks = collisionStats.checks;
  const hitA = tests[0][1] || tests[1][1] || tests[3][1] || tests[5][1], hitB = tests[0][1] || tests[2][1] || tests[4][1] || tests[6][1];
  useEffect(() => {
    const ctx = ref.current.getContext('2d'); ctx.fillStyle = '#060b17'; ctx.fillRect(0, 0, W, H);
    const rect = (r, hit, label) => { ctx.fillStyle = hit ? 'rgba(255,77,109,0.25)' : 'rgba(75,106,163,0.25)'; ctx.strokeStyle = hit ? '#ff4d6d' : '#4b6aa3'; ctx.lineWidth = 2; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#8ea3c7'; ctx.font = '700 12px "Chakra Petch"'; ctx.fillText(label, r.x + 8, r.y + 18); };
    rect(s.rectA, hitA, 'RECT A'); rect(s.rectB, hitB, 'RECT B (drag)');
    const cHit = tests[1][1] || tests[2][1]; ctx.fillStyle = cHit ? 'rgba(255,77,109,0.3)' : 'rgba(34,211,238,0.2)'; ctx.strokeStyle = cHit ? '#ff4d6d' : '#22d3ee'; ctx.beginPath(); ctx.arc(s.circle.x, s.circle.y, s.circle.r, 0, 7); ctx.fill(); ctx.stroke();
    const sHit = tests[5][1] || tests[6][1]; ctx.strokeStyle = sHit ? '#ff4d6d' : '#a78bfa'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s.seg[0].x, s.seg[0].y); ctx.lineTo(s.seg[1].x, s.seg[1].y); ctx.stroke();
    for (const p of s.seg) { ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); }
    const pHit = tests[3][1] || tests[4][1]; ctx.fillStyle = pHit ? '#ff4d6d' : '#fbbf24'; ctx.beginPath(); ctx.arc(s.point.x, s.point.y, 6, 0, 7); ctx.fill();
  });
  const down = (e) => {
    const p = cp(e, ref.current); e.currentTarget.setPointerCapture(e.pointerId);
    const inR = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (dist(p, s.point) < 14) s.drag = { k: 'point' }; else if (dist(p, s.seg[0]) < 12) s.drag = { k: 's0' }; else if (dist(p, s.seg[1]) < 12) s.drag = { k: 's1' };
    else if (dist(p, s.circle) < s.circle.r) s.drag = { k: 'circle', dx: p.x - s.circle.x, dy: p.y - s.circle.y };
    else if (inR(s.rectB)) s.drag = { k: 'rectB', dx: p.x - s.rectB.x, dy: p.y - s.rectB.y }; else if (inR(s.rectA)) s.drag = { k: 'rectA', dx: p.x - s.rectA.x, dy: p.y - s.rectA.y }; else s.drag = null;
  };
  const move = (e) => {
    const d = s.drag; if (!d) return; const p = cp(e, ref.current);
    if (d.k === 'point') s.point = { x: p.x, y: p.y }; else if (d.k === 's0') s.seg[0] = { x: p.x, y: p.y }; else if (d.k === 's1') s.seg[1] = { x: p.x, y: p.y };
    else if (d.k === 'circle') { s.circle.x = p.x - d.dx; s.circle.y = p.y - d.dy; } else { s[d.k].x = p.x - d.dx; s[d.k].y = p.y - d.dy; }
    tick();
  };
  return (
    <div className="lab">
      <div>
        <canvas ref={ref} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={() => { s.drag = null; }} />
        <Legend items={[['#4b6aa3', 'Rect (no collision)'], ['#ff4d6d', 'Colliding'], ['#22d3ee', 'Circle (person)'], ['#fbbf24', 'Point'], ['#a78bfa', 'Segment']]} />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Drag any shape. Rect A is draggable too.</p>
      </div>
      <div className="lab-side">
        <InfoPanel id="collision" />
        <div className="panel"><h3>Collision engine</h3>
          <Rows rows={[...tests.map(([k, v]) => [k, v ? 'COLLISION' : '—']), ['Checks this frame', checks]]} />
        </div>
      </div>
    </div>
  );
}
