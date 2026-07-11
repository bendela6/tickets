// Drop consecutive (near-)duplicate points from a polyline — path builders need
// clean vertices or they emit zero-length segments and degenerate corner curves.

import type { Point } from '../types';

export function dedupePoints(pts: Point[]): Point[] {
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const q = out[out.length - 1]!;
    if (Math.abs(p.x - q.x) > 0.01 || Math.abs(p.y - q.y) > 0.01) out.push(p);
  }
  return out;
}
