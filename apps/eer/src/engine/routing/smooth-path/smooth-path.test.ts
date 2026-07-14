import { describe, expect, it } from 'vitest';

import { smoothPath } from './smooth-path';

describe('smoothPath', () => {
  it('renders a 2-point polyline as a single M + L', () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toBe('M 0 0 L 100 0');
  });

  it('rounds a bend with a quadratic curve whose control point is the corner', () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d).toContain('Q 100 0'); // corner (100,0) is the control point
    expect(d.endsWith('L 100 100')).toBe(true);
  });

  it('caps the corner radius at half the shorter leg', () => {
    // legs 10 and 100 → rad = min(16, 5, 50) = 5
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 100 },
    ]);
    expect(d).toContain('L 5 0 Q 10 0 10 5');
  });

  it('dedupes duplicate points before building the path', () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toBe('M 0 0 L 100 0');
  });
});
