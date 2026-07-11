// SVG path for an orthogonal polyline with rounded corners: straight L runs with
// a quadratic curve around every bend ("avoid" line mode).

import { dedupePoints } from '../dedupe-points';
import type { Point } from '../types';

export function smoothPath(pts: Point[]): string {
  pts = dedupePoints(pts);
  if (pts.length < 3) return `M ${r(pts[0]!.x)} ${r(pts[0]!.y)} L ${r(last(pts).x)} ${r(last(pts).y)}`;
  let d = `M ${r(pts[0]!.x)} ${r(pts[0]!.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const rad = Math.min(16, dist(p0, p1) / 2, dist(p1, p2) / 2);
    const a = toward(p1, p0, rad);
    const b = toward(p1, p2, rad);
    d += ` L ${r(a.x)} ${r(a.y)} Q ${r(p1.x)} ${r(p1.y)} ${r(b.x)} ${r(b.y)}`;
  }
  d += ` L ${r(last(pts).x)} ${r(last(pts).y)}`;
  return d;
}

function toward(from: Point, to: Point, d: number): Point {
  const len = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / len) * d, y: from.y + ((to.y - from.y) / len) * d };
}
function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function last(a: Point[]): Point {
  return a[a.length - 1]!;
}
function r(n: number): number {
  return Math.round(n * 10) / 10;
}
