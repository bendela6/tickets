import { describe, expect, it } from 'vitest';

import { polyMidpoint } from './poly-midpoint';

describe('polyMidpoint', () => {
  it('returns the corner of an L-path with equal 100+100 legs', () => {
    expect(
      polyMidpoint([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]),
    ).toEqual({ x: 100, y: 0 });
  });

  it('returns the center of a straight segment', () => {
    expect(
      polyMidpoint([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toEqual({ x: 50, y: 0 });
  });

  it('walks into the second leg when it carries most of the length', () => {
    // total 100, half 50: 30 along the first leg, remaining 20 down the second
    const p = polyMidpoint([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 70 },
    ]);
    expect(p.x).toBe(30);
    expect(p.y).toBeCloseTo(20, 6);
  });
});
