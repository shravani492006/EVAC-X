import { useState } from 'react';
import { ALGO_INFO } from '../../data/algoInfo.js';

/** Convert a pointer event to canvas pixel coordinates (canvas may be CSS-scaled). */
export const cp = (e, canvas) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
};
export const useTick = () => { const [, s] = useState(0); return () => s((n) => n + 1); };
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function InfoPanel({ id }) {
  const i = ALGO_INFO[id];
  return (
    <div className="panel">
      <h3>{i.name}</h3>
      <p>{i.summary}</p>
      <p style={{ marginTop: 8 }}><b>Input:</b> {i.input}</p>
      <p><b>Output:</b> {i.output}</p>
      <p className="mono cyan" style={{ fontSize: 12, marginTop: 8 }}>{i.flow}</p>
      <p style={{ marginTop: 8 }}><b>In EVAC-X:</b> {i.game}</p>
    </div>
  );
}
export const Rows = ({ rows }) => <div className="rows">{rows.map(([k, v], i) => [<span key={`k${i}`}>{k}</span>, <span key={`v${i}`}>{String(v)}</span>])}</div>;
export const Legend = ({ items }) => <div className="legend">{items.map(([c, t]) => <span key={t}><i style={{ background: c }} />{t}</span>)}</div>;
