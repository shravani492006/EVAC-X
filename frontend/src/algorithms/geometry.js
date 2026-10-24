/**
 * Collision detection + line-segment intersection (all implemented manually).
 * `collisionStats` is read by the Algorithm Inspector.
 */
export const collisionStats = { checks: 0, collisions: 0, blocked: 0 };
export function resetCollisionStats() { collisionStats.checks = 0; collisionStats.collisions = 0; collisionStats.blocked = 0; }

/**
 * Segment A(p1→p2) vs segment B(p3→p4).
 * Solve p1 + t·r = p3 + u·s using 2D cross products:
 *   t = (q−p)×s / (r×s),  u = (q−p)×r / (r×s)
 * Intersect iff 0 ≤ t ≤ 1 and 0 ≤ u ≤ 1. r×s = 0 means parallel.
 */
export function segmentIntersection(p1, p2, p3, p4) {
  collisionStats.checks++;
  const rx = p2.x - p1.x, ry = p2.y - p1.y;
  const sx = p4.x - p3.x, sy = p4.y - p3.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return { hit: false, parallel: true, t: null, u: null, x: null, y: null, den };
  const qpx = p3.x - p1.x, qpy = p3.y - p1.y;
  const t = (qpx * sy - qpy * sx) / den;
  const u = (qpx * ry - qpy * rx) / den;
  const hit = t >= 0 && t <= 1 && u >= 0 && u <= 1;
  return { hit, parallel: false, t, u, x: p1.x + t * rx, y: p1.y + t * ry, den };
}

export function pointInRect(p, r) {
  collisionStats.checks++;
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
/** Axis-aligned rectangles overlap iff they overlap on both axes. */
export function rectVsRect(a, b) {
  collisionStats.checks++;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
/** Circle vs rect: clamp circle centre to the rect, compare distance to radius. */
export function circleVsRect(c, r) {
  collisionStats.checks++;
  const nx = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - nx, dy = c.y - ny;
  return dx * dx + dy * dy < c.r * c.r;
}
export function rectEdges(r) {
  const x2 = r.x + r.w, y2 = r.y + r.h;
  return [
    [{ x: r.x, y: r.y }, { x: x2, y: r.y }], [{ x: x2, y: r.y }, { x: x2, y: y2 }],
    [{ x: x2, y: y2 }, { x: r.x, y: y2 }], [{ x: r.x, y: y2 }, { x: r.x, y: r.y }]
  ];
}
/** Segment vs rect: endpoint inside, or segment crosses any of the four edges. */
export function segmentVsRect(a, b, r) {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  for (const [e1, e2] of rectEdges(r)) if (segmentIntersection(a, b, e1, e2).hit) return true;
  return false;
}
/** Line-of-sight: true when no wall segment blocks A→B. */
export function hasLineOfSight(a, b, wallSegments) {
  for (let i = 0; i < wallSegments.length; i++) {
    const w = wallSegments[i];
    if (segmentIntersection(a, b, w.a, w.b).hit) return false;
  }
  return true;
}
