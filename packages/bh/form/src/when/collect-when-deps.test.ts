import { describe, expect, test } from 'vitest';
import { collectWhenDeps } from './collect-when-deps';
import type { WhenClause } from '../types/when';

describe('collectWhenDeps', () => {
  test('returns empty set for combinator with no leaves', () => {
    expect([...collectWhenDeps({ all: [] })]).toEqual([]);
  });

  test('returns single field for leaf clause', () => {
    expect([...collectWhenDeps({ field: 'country', eq: 'US' })]).toEqual(['country']);
  });

  test('dedupes repeated fields', () => {
    const c: WhenClause = {
      any: [
        { field: 'role', eq: 'admin' },
        { field: 'role', eq: 'editor' },
      ],
    };
    expect([...collectWhenDeps(c)].sort()).toEqual(['role']);
  });

  test('collects nested fields across all/any/not', () => {
    const c: WhenClause = {
      all: [
        { field: 'country', eq: 'US' },
        { not: { field: 'banned', truthy: true } },
        {
          any: [
            { field: 'tier', in: ['gold', 'silver'] },
            { field: 'role', neq: 'guest' },
          ],
        },
      ],
    };
    expect([...collectWhenDeps(c)].sort()).toEqual(['banned', 'country', 'role', 'tier']);
  });
});
