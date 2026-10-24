import { useEffect, useRef, useState } from 'react';
import { Mat3, degToRad, transformPoints } from '../../algorithms/transform.js';
import { InfoPanel, Rows, Legend } from './labCommon.jsx';

const W = 768, H = 480;
const SHAPE = [[-50, -30], [50, -30], [50, 30], [0, 64], [-50, 30]];

export default function TransformLab() {
  const ref = useRef(null);
  const [p, setP] = useState({ tx: 120, ty: -40, theta: 30, sx: 1, sy: 1, rx: false, ry: false, order: 'TRS' });
  const set = (k) => (e) => setP((v) => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value }));

  const T = Mat3.translation(p.tx, p.ty), R = Mat3.rotation(degToRad(p.theta)), S = Mat3.scaling(p.sx, p.sy);
  let F = Mat3.identity(); if (p.rx) F = F.multiply(Mat3.reflectX()); if (p.ry) F = F.multiply(Mat3.reflectY());
  const M = p.order === 'TRS' ? Mat3.compose(T, R, S, F) : Mat3.compose(R, S, T, F);
  const out = transformPoints(M, SHAPE);

  useEffect(() => {
    const ctx = ref.current.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#060b17'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.strokeStyle = 'rgba(120,170,255,0.08)'; ctx.beginPath(); for (let x = -W / 2; x < W / 2; x += 32) { ctx.moveTo(x, -H / 2); ctx.lineTo(x, H / 2); } for (let y = -H / 2; y < H / 2; y += 32) { ctx.moveTo(-W / 2, y); ctx.lineTo(W / 2, y); } ctx.stroke();
    ctx.strokeStyle = 'rgba(142,163,199,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-W / 2, 0); ctx.lineTo(W / 2, 0); ctx.moveTo(0, -H / 2); ctx.lineTo(0, H / 2); ctx.stroke();
    ctx.fillStyle = '#8ea3c7'; ctx.font = '11px "IBM Plex Mono"'; ctx.fillText('x →', W / 2 - 30, -6); ctx.fillText('y ↓', 8, H / 2 - 8);
    const poly = (pts, fill, stroke, dash) => { ctx.setLineDash(dash || []); ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((q, i) => { const x = q.x ?? q[0], y = q.y ?? q[1]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); };
    poly(SHAPE, 'rgba(142,163,199,0.08)', 'rgba(142,163,199,0.6)', [6, 4]);
    poly(out, 'rgba(34,211,238,0.2)', '#22d3ee');
    // local axes of the transformed object (x = red, y = green)
    const o = M.apply(0, 0), ax = M.apply(40, 0), ay = M.apply(0, 40);
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ax.x, ax.y); ctx.stroke(); ctx.strokeStyle = '#34d399'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ay.x, ay.y); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; out.forEach((q) => { ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, 7); ctx.fill(); });
  });
  const rows = M.rows(2), d = M.decompose();
  const sl = (label, k, min, max, step) => <div className="slider-row"><span>{label}</span><input type="range" min={min} max={max} step={step} value={p[k]} onChange={set(k)} /><output>{p[k]}</output></div>;
  return (
    <div className="lab">
      <div>
        <canvas ref={ref} width={W} height={H} />
        <Legend items={[['#8ea3c7', 'Original'], ['#22d3ee', 'Transformed'], ['#ff4d6d', "Local x′ axis"], ['#34d399', "Local y′ axis"]]} />
        <div className="panel" style={{ marginTop: 12 }}>
          {sl('Tx', 'tx', -300, 300, 1)}{sl('Ty', 'ty', -200, 200, 1)}{sl('θ°', 'theta', -180, 180, 1)}{sl('Sx', 'sx', -2, 2.5, 0.05)}{sl('Sy', 'sy', -2, 2.5, 0.05)}
          <div className="controls">
            <label><input type="checkbox" checked={p.rx} onChange={set('rx')} />Reflect X-axis</label><label><input type="checkbox" checked={p.ry} onChange={set('ry')} />Reflect Y-axis</label>
            <label>Order <select value={p.order} onChange={set('order')}><option value="TRS">M = T·R·S (scale, rotate, then move)</option><option value="RST">M = R·S·T (move, then rotate about origin)</option></select></label>
            <button className="btn sm" onClick={() => setP({ tx: 0, ty: 0, theta: 0, sx: 1, sy: 1, rx: false, ry: false, order: 'TRS' })}>RESET</button>
          </div>
        </div>
      </div>
      <div className="lab-side">
        <InfoPanel id="transform" />
        <div className="panel"><h3>Transformation inspector</h3>
          <Rows rows={[['Translation Tx', d.tx.toFixed(1)], ['Translation Ty', d.ty.toFixed(1)], ['Rotation θ', `${(p.theta)}°`], ['Scale X', p.sx.toFixed(2)], ['Scale Y', p.sy.toFixed(2)], ['det(M)', M.det().toFixed(3)]]} />
          <div className="matrix">{rows.flat().map((v, i) => <span key={i}>{v}</span>)}</div>
        </div>
        <div className="panel"><h3>Vertices P → P′ = M·P</h3>
          <table className="mini-tbl"><thead><tr><th>#</th><th>P</th><th>P′</th></tr></thead><tbody>{SHAPE.map((q, i) => <tr key={i}><td>{i}</td><td>({q[0]}, {q[1]})</td><td>({out[i].x.toFixed(1)}, {out[i].y.toFixed(1)})</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
