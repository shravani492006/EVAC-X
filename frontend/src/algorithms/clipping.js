/**
 * Liang–Barsky parametric line clipping (manual implementation).
 * P(t) = P0 + t·(dx,dy), t ∈ [0,1]. For each window edge k:  p_k·t ≤ q_k
 *   p = [−dx, dx, −dy, dy]   q = [x0−xmin, xmax−x0, y0−ymin, ymax−y0]
 * p_k = 0 → parallel to that edge (outside if q_k < 0).
 * p_k < 0 → entering: t0 = max(t0, r_k);  p_k > 0 → leaving: t1 = min(t1, r_k).
 */
const NAMES = ['LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

export function liangBarsky(x0, y0, x1, y1, xmin, ymin, xmax, ymax, trace = false) {
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
  let t0 = 0, t1 = 1;
  const steps = trace ? [] : null;
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] < 0) { steps && steps.push({ edge: NAMES[k], p: p[k], q: q[k], r: null, action: 'parallel & outside → reject' }); return { accepted: false, clipped: true, t0, t1, steps }; }
      steps && steps.push({ edge: NAMES[k], p: p[k], q: q[k], r: null, action: 'parallel & inside → skip' });
      continue;
    }
    const r = q[k] / p[k];
    if (p[k] < 0) {
      if (r > t1) { steps && steps.push({ edge: NAMES[k], p: p[k], q: q[k], r, action: 'r > t1 → reject' }); return { accepted: false, clipped: true, t0, t1, steps }; }
      if (r > t0) t0 = r;
      steps && steps.push({ edge: NAMES[k], p: p[k], q: q[k], r, action: `entering → t0 = ${t0.toFixed(3)}` });
    } else {
      if (r < t0) { steps && steps.push({ edge: NAMES[k], p: p[k], q: q[k], r, action: 'r < t0 → reject' }); return { accepted: false, clipped: true, t0, t1, steps }; }
      if (r < t1) t1 = r;
      steps && steps.push({ edge: NAMES[k], p: p[k], q: q[k], r, action: `leaving → t1 = ${t1.toFixed(3)}` });
    }
  }
  return { accepted: true, clipped: t0 > 0 || t1 < 1, t0, t1, x0: x0 + t0 * dx, y0: y0 + t0 * dy, x1: x0 + t1 * dx, y1: y0 + t1 * dy, steps };
}

export class ClipStats {
  constructor() { this.reset(); }
  reset() { this.tested = 0; this.clipped = 0; this.rejected = 0; this.visible = 0; }
  record(res) {
    this.tested++;
    if (!res.accepted) { this.rejected++; this.clipped++; return; }
    this.visible++;
    if (res.clipped) this.clipped++;
  }
}

/** Clip a polyline [{x,y}...] against a rectangle; returns visible segments [x0,y0,x1,y1]. */
export function clipPolyline(points, rect, stats, out = []) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const r = liangBarsky(a.x, a.y, b.x, b.y, rect.xmin, rect.ymin, rect.xmax, rect.ymax);
    if (stats) stats.record(r);
    if (r.accepted) out.push([r.x0, r.y0, r.x1, r.y1]);
  }
  return out;
}
