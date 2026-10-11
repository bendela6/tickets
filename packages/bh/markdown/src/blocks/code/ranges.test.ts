import { describe, expect, it } from 'vitest';
import { parseRanges } from './ranges';

describe('parseRanges', () => {
  it('reads single lines and ranges', () => {
    expect([...parseRanges('3,9-11')].sort((a, b) => a - b)).toEqual([3, 9, 10, 11]);
  });

  it('ignores what it cannot read', () => {
    expect(parseRanges('x, 4-, -2, 5')).toEqual(new Set([5]));
  });

  it('is empty for nothing', () => {
    expect(parseRanges(undefined)).toEqual(new Set());
  });
});
