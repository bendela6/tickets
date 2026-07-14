// SVG path for an orthogonal polyline with sharp corners ("ortho" line mode).

import { dedupePoints } from '../dedupe-points';
import type { Point } from '../../model/types';

export function orthoPolyPath(pts: Point[]): string {
  pts = dedupePoints(pts);
  let d = `M ${r(pts[0]!.x)} ${r(pts[0]!.y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${r(pts[i]!.x)} ${r(pts[i]!.y)}`;
  return d;
}

function r(n: number): number {
  return Math.round(n * 10) / 10;
}
