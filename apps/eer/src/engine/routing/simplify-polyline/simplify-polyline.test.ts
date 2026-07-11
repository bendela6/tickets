import { describe, expect, it } from 'vitest';

import { simplifyPolyline } from './simplify-polyline';

describe('simplifyPolyline', () => {
  it('collapses collinear runs into single segments, keeping the endpoints', () => {
    const pts = simplifyPolyline([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 9, y: 0 }, // horizontal run
      { x: 9, y: 3 },
      { x: 9, y: 7 }, // vertical run
    ]);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 7 },
    ]);
  });

  it('keeps every real corner of a staircase', () => {
    const stairs = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 5 },
    ];
    expect(simplifyPolyline(stairs)).toEqual(stairs);
  });

  it('dedupes before simplifying, so repeated vertices cannot fake a corner', () => {
    const pts = simplifyPolyline([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ]);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ]);
  });

  it('passes a bare two-point segment through untouched', () => {
    expect(
      simplifyPolyline([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
  });
});
