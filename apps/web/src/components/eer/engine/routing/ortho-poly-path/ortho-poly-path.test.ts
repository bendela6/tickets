import { describe, expect, it } from 'vitest';

import { orthoPolyPath } from './ortho-poly-path';

describe('orthoPolyPath', () => {
  it('emits an M then an L per point, with sharp corners (no Q)', () => {
    const d = orthoPolyPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
    expect(d).toBe('M 0 0 L 100 0 L 100 50');
    expect(d).not.toContain('Q');
  });

  it('dedupes consecutive duplicate points', () => {
    const d = orthoPolyPath([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
    expect(d).toBe('M 0 0 L 100 0 L 100 50');
  });

  it('rounds coordinates to a tenth', () => {
    expect(
      orthoPolyPath([
        { x: 0.04, y: 0 },
        { x: 100.06, y: 0.25 },
      ]),
    ).toBe('M 0 0 L 100.1 0.3');
  });
});
