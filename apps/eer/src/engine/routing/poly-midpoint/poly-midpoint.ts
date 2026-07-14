// The point halfway along a polyline's length (label anchoring).

import type { Point } from '../../model/types';

export function polyMidpoint(pts: Point[]): Point {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist(a, b);
    if (half <= d) {
      const k = d ? half / d : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    half -= d;
  }
  return pts[pts.length - 1]!;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
