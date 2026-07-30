// After simplification a routed polyline can end with a degenerate port
// approach: when A* is forced to overshoot the port column and double back to
// the stub waypoint, simplify-polyline collapses the reversal (it merges by
// shared coordinate, not direction) and the guaranteed STUB-long horizontal
// run-in shrinks to almost nothing — the crow's foot then floats beside the
// vertical, because headPath assumes a straight horizontal approach. Rebuild
// such tails with a jog: leave the incoming vertical one lane early, run over
// to the stub column, and enter the port straight. Every new segment is
// obstacle-checked; when no jog lane is free the polyline stays as it was.

import { STUB } from '../../geometry/metrics';
import type { Point, Side } from '../../model/types';

const JOG = 9; // matches compute-routes LANE_STEP, so the jog reads as one lane over

export type SegBlocked = (x1: number, y1: number, x2: number, y2: number) => boolean;

export function enforcePortStub(pts: Point[], side: Side, end: 'start' | 'end', blocked: SegBlocked): Point[] {
  if (end === 'start') return enforceTail([...pts].reverse(), side, blocked).reverse();
  return enforceTail(pts, side, blocked);
}

function enforceTail(pts: Point[], side: Side, blocked: SegBlocked): Point[] {
  if (pts.length < 4) return pts;
  const p2 = pts[pts.length - 1]!; // the port
  const q = pts[pts.length - 2]!; // the bend feeding it
  const r = pts[pts.length - 3]!;
  const out = side === 'R' ? 1 : -1; // direction from the port away from its card
  // Only the standard tail shape is repairable: vertical r→q, horizontal stub q→p2.
  if (Math.abs(q.y - p2.y) > 0.01 || Math.abs(r.x - q.x) > 0.01) return pts;
  const run = (q.x - p2.x) * out; // how far the stub actually runs outward
  if (run >= STUB - 0.5) return pts;
  const bx = p2.x + out * STUB;
  const fromAbove = r.y < q.y; // prefer jogging back toward where the vertical came from
  for (const jy of fromAbove ? [p2.y - JOG, p2.y + JOG] : [p2.y + JOG, p2.y - JOG]) {
    if (blocked(q.x, r.y, q.x, jy)) continue; // the incoming vertical now ends at jy
    if (blocked(q.x, jy, bx, jy) || blocked(bx, jy, bx, p2.y) || blocked(bx, p2.y, p2.x, p2.y)) continue;
    return [...pts.slice(0, -2), { x: q.x, y: jy }, { x: bx, y: jy }, { x: bx, y: p2.y }, p2];
  }
  return pts;
}
