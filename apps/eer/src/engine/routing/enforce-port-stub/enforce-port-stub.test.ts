import { describe, expect, it } from 'vitest';

import { STUB } from '../../geometry/metrics';
import { enforcePortStub } from './enforce-port-stub';
import type { Point } from '../../model/types';

const free = () => false;

// The collapsed-overshoot tail from the live bug: the router descends 2px from
// the port column (118 vs port 120), simplify ate the doubled-back b1 waypoint,
// leaving a 2px final stub where headPath needs a straight HEAD_LEN run-in.
const collapsed = (): Point[] => [
  { x: 0, y: 0 },
  { x: 118, y: 0 },
  { x: 118, y: 50 },
  { x: 120, y: 50 },
];

describe('enforcePortStub', () => {
  it('rebuilds a collapsed tail with a jog restoring the full stub', () => {
    expect(enforcePortStub(collapsed(), 'L', 'end', free)).toEqual([
      { x: 0, y: 0 },
      { x: 118, y: 0 },
      { x: 118, y: 41 },
      { x: 100, y: 41 },
      { x: 100, y: 50 },
      { x: 120, y: 50 },
    ]);
  });

  it('leaves a tail with a full-length stub untouched', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 120, y: 50 },
    ];
    expect(enforcePortStub(pts, 'L', 'end', free)).toEqual(pts);
  });

  it('jogs below when the lane above the port row is blocked', () => {
    const blockedAbove = (x1: number, y1: number, _x2: number, y2: number) => y1 === 41 || y2 === 41;
    expect(enforcePortStub(collapsed(), 'L', 'end', blockedAbove)).toEqual([
      { x: 0, y: 0 },
      { x: 118, y: 0 },
      { x: 118, y: 59 },
      { x: 100, y: 59 },
      { x: 100, y: 50 },
      { x: 120, y: 50 },
    ]);
  });

  it('returns the polyline unchanged when no jog lane is free', () => {
    const pts = collapsed();
    expect(enforcePortStub(pts, 'L', 'end', () => true)).toEqual(pts);
  });

  it('mirrors for a right-side port', () => {
    const pts: Point[] = [
      { x: 200, y: 0 },
      { x: 82, y: 0 },
      { x: 82, y: 50 },
      { x: 80, y: 50 },
    ];
    expect(enforcePortStub(pts, 'R', 'end', free)).toEqual([
      { x: 200, y: 0 },
      { x: 82, y: 0 },
      { x: 82, y: 41 },
      { x: 100, y: 41 },
      { x: 100, y: 50 },
      { x: 80, y: 50 },
    ]);
  });

  it('repairs the source end via start mode', () => {
    const pts: Point[] = [
      { x: 120, y: 50 },
      { x: 118, y: 50 },
      { x: 118, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(enforcePortStub(pts, 'L', 'start', free)).toEqual([
      { x: 120, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 41 },
      { x: 118, y: 41 },
      { x: 118, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('ignores tails that do not end vertical-then-stub', () => {
    const pts: Point[] = [
      { x: 0, y: 50 },
      { x: 60, y: 50 },
      { x: 120, y: 50 },
    ];
    expect(enforcePortStub(pts, 'L', 'end', free)).toEqual(pts);
  });

  it('restores exactly STUB of straight approach', () => {
    const fixed = enforcePortStub(collapsed(), 'L', 'end', free);
    const p2 = fixed[fixed.length - 1]!;
    const q = fixed[fixed.length - 2]!;
    expect(p2.x - q.x).toBe(STUB);
    expect(q.y).toBe(p2.y);
  });
});
