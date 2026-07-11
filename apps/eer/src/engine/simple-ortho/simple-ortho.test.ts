import { describe, expect, it } from 'vitest';

import { STUB } from '../metrics';
import { simpleOrtho } from './simple-ortho';
import type { Point } from '../types';

describe('simpleOrtho', () => {
  it('starts at p1, ends at p2, and keeps every segment axis-aligned', () => {
    const p1: Point = { x: 0, y: 0 };
    const p2: Point = { x: 200, y: 100 };
    const pts = simpleOrtho(p1, p2, 'R', 'L');
    expect(pts[0]).toEqual(p1);
    expect(pts[pts.length - 1]).toEqual(p2);
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i]!.x - pts[i - 1]!.x);
      const dy = Math.abs(pts[i]!.y - pts[i - 1]!.y);
      expect(Math.min(dx, dy)).toBe(0); // every leg is H or V
    }
  });

  it('leaves the source horizontally by exactly STUB toward side R', () => {
    // Ports at the same x, both exiting right: the stub cannot merge into the mid run.
    const pts = simpleOrtho({ x: 0, y: 0 }, { x: 0, y: 100 }, 'R', 'R');
    expect(pts[1]).toEqual({ x: STUB, y: 0 });
  });

  it('leaves the source toward negative x for side L', () => {
    const pts = simpleOrtho({ x: 0, y: 0 }, { x: 0, y: 100 }, 'L', 'L');
    expect(pts[1]).toEqual({ x: -STUB, y: 0 });
  });

  it('keeps the first leg horizontal and at least STUB long when it merges with the mid run', () => {
    const pts = simpleOrtho({ x: 0, y: 0 }, { x: 200, y: 100 }, 'R', 'L');
    expect(pts[1]!.y).toBe(0); // still leaves horizontally
    expect(pts[1]!.x).toBeGreaterThanOrEqual(STUB); // stub absorbed into a longer run, same direction
  });
});
