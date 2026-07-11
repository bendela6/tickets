import { describe, expect, it } from 'vitest';

import { dedupePoints } from './dedupe-points';

describe('dedupePoints', () => {
  it('drops consecutive points within the 0.01 tolerance', () => {
    const pts = dedupePoints([
      { x: 0, y: 0 },
      { x: 0, y: 0.005 }, // sub-tolerance jitter
      { x: 0.009, y: 0.009 },
      { x: 5, y: 0 },
    ]);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it('keeps points that move more than the tolerance on either axis', () => {
    const pts = dedupePoints([
      { x: 0, y: 0 },
      { x: 0.02, y: 0 },
      { x: 0.02, y: 0.02 },
    ]);
    expect(pts).toHaveLength(3);
  });

  it('only collapses consecutive repeats — a revisited point survives', () => {
    const pts = dedupePoints([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(pts).toHaveLength(3);
  });
});
