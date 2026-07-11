// Collapse collinear runs of an orthogonal polyline into single segments (after
// deduping), so lane separation and path builders see one segment per straight run.

import { dedupePoints } from '../dedupe-points';
import type { Point } from '../types';

export function simplifyPolyline(pts: Point[]): Point[] {
  pts = dedupePoints(pts);
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!collinear) out.push(b);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
