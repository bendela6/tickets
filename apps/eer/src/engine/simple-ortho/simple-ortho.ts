// Plain orthogonal fallback route: stub out of each pin, one vertical jog at the
// horizontal midpoint. Used live while dragging and whenever A* has no path.

import { STUB } from '../metrics';
import { simplifyPolyline } from '../simplify-polyline';
import type { Point, Side } from '../types';

export function simpleOrtho(p1: Point, p2: Point, s: Side, t: Side): Point[] {
  const a1: Point = { x: p1.x + (s === 'R' ? STUB : -STUB), y: p1.y };
  const b1: Point = { x: p2.x + (t === 'R' ? STUB : -STUB), y: p2.y };
  const mx = (a1.x + b1.x) / 2;
  return simplifyPolyline([p1, a1, { x: mx, y: a1.y }, { x: mx, y: b1.y }, b1, p2]);
}
