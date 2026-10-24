/**
 * 2D transformations in homogeneous coordinates.
 * Row-major 3x3 matrix:
 *   [ m0 m1 m2 ]     [ cosθ -sinθ tx ]
 *   [ m3 m4 m5 ]  =  [ sinθ  cosθ ty ]
 *   [ m6 m7 m8 ]     [  0     0    1 ]
 * A point (x, y) is the column vector [x y 1]^T, so P' = M · P.
 */
export const degToRad = (d) => (d * Math.PI) / 180;
export const radToDeg = (r) => (r * 180) / Math.PI;

export class Mat3 {
  constructor(m) { this.m = m || [1, 0, 0, 0, 1, 0, 0, 0, 1]; }
  static identity() { return new Mat3(); }
  static translation(tx, ty) { return new Mat3([1, 0, tx, 0, 1, ty, 0, 0, 1]); }
  static rotation(a) { const c = Math.cos(a), s = Math.sin(a); return new Mat3([c, -s, 0, s, c, 0, 0, 0, 1]); }
  static scaling(sx, sy = sx) { return new Mat3([sx, 0, 0, 0, sy, 0, 0, 0, 1]); }
  /** Reflection about the X axis (y -> -y). */
  static reflectX() { return new Mat3([1, 0, 0, 0, -1, 0, 0, 0, 1]); }
  /** Reflection about the Y axis (x -> -x). */
  static reflectY() { return new Mat3([-1, 0, 0, 0, 1, 0, 0, 0, 1]); }
  static rotationAbout(a, cx, cy) { return Mat3.compose(Mat3.translation(cx, cy), Mat3.rotation(a), Mat3.translation(-cx, -cy)); }
  static scalingAbout(sx, sy, cx, cy) { return Mat3.compose(Mat3.translation(cx, cy), Mat3.scaling(sx, sy), Mat3.translation(-cx, -cy)); }
  /** compose(A,B,C) = A·B·C — C is applied to the point first. */
  static compose(...ms) { return ms.reduce((a, b) => a.multiply(b)); }

  multiply(o) {
    const a = this.m, b = o.m, r = new Array(9);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return new Mat3(r);
  }
  apply(x, y) { const m = this.m; return { x: m[0] * x + m[1] * y + m[2], y: m[3] * x + m[4] * y + m[5] }; }
  /** Direction vectors ignore translation (w = 0). */
  applyVector(x, y) { const m = this.m; return { x: m[0] * x + m[1] * y, y: m[3] * x + m[4] * y }; }
  det() { const m = this.m; return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]); }
  inverse() {
    const m = this.m, d = this.det();
    if (Math.abs(d) < 1e-12) return Mat3.identity();
    const i = 1 / d;
    return new Mat3([
      (m[4] * m[8] - m[5] * m[7]) * i, (m[2] * m[7] - m[1] * m[8]) * i, (m[1] * m[5] - m[2] * m[4]) * i,
      (m[5] * m[6] - m[3] * m[8]) * i, (m[0] * m[8] - m[2] * m[6]) * i, (m[2] * m[3] - m[0] * m[5]) * i,
      (m[3] * m[7] - m[4] * m[6]) * i, (m[1] * m[6] - m[0] * m[7]) * i, (m[0] * m[4] - m[1] * m[3]) * i
    ]);
  }
  /** Arguments for CanvasRenderingContext2D.setTransform(a,b,c,d,e,f). */
  toCanvas() { const m = this.m; return [m[0], m[3], m[1], m[4], m[2], m[5]]; }
  /** Extract translation / rotation / scale (valid for T·R·S matrices). */
  decompose() {
    const m = this.m;
    const sx = Math.hypot(m[0], m[3]) * (this.det() < 0 ? -1 : 1);
    const sy = Math.hypot(m[1], m[4]);
    return { tx: m[2], ty: m[5], rotation: Math.atan2(m[3], m[0]), sx, sy };
  }
  rows(digits = 2) {
    const f = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(digits);
    return [0, 1, 2].map((r) => [0, 1, 2].map((c) => f(this.m[r * 3 + c])));
  }
}

export function transformPoints(M, pts) {
  const out = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y;
    out[i] = M.apply(x, y);
  }
  return out;
}
