import { expect, test } from 'vitest';
import { KIND_TONE } from '../domain/status';
import type { StatusKind } from '../api/types';
import { kindColor } from './option-color';

// kindColor must delegate to domain/status.ts's KIND_TONE — the app's ONE
// status-kind color mapping — so the two can never drift apart again.
test('kindColor agrees with KIND_TONE for every status kind', () => {
  const kinds: StatusKind[] = ['todo', 'active', 'blocked', 'done', 'dropped'];
  for (const kind of kinds) {
    expect(kindColor(kind)).toBe(KIND_TONE[kind]);
  }
});

test('kindColor falls back to gray for a null kind', () => {
  expect(kindColor(null)).toBe('gray');
});
