import { expect, test } from 'vitest';
import { KIND_TONE } from '../domain/status';
import type { StatusKind } from '../api/types';
import { hexToOptionColor, kindColor } from './option-color';

// Real hex values stored in option/status configs in the dev database.
test('maps stored config hexes onto the nearest palette color', () => {
  expect(hexToOptionColor('#d03b3b')).toBe('red');
  expect(hexToOptionColor('#fab219')).toBe('yellow');
  expect(hexToOptionColor('#898781')).toBe('gray');
  expect(hexToOptionColor('#3987e5')).toBe('blue');
  expect(hexToOptionColor('#8f7ae8')).toBe('indigo');
  expect(hexToOptionColor('#0ca30c')).toBe('green');
});

test('falls back to gray for missing or malformed values', () => {
  expect(hexToOptionColor(undefined)).toBe('gray');
  expect(hexToOptionColor(null)).toBe('gray');
  expect(hexToOptionColor('')).toBe('gray');
  expect(hexToOptionColor('rebeccapurple')).toBe('gray');
  expect(hexToOptionColor('#12')).toBe('gray');
});

test('covers the remaining palette hues', () => {
  expect(hexToOptionColor('#e8590c')).toBe('orange');
  expect(hexToOptionColor('#0d9488')).toBe('teal');
  expect(hexToOptionColor('#0891b2')).toBe('cyan');
  expect(hexToOptionColor('#9333ea')).toBe('purple');
  expect(hexToOptionColor('#db2777')).toBe('pink');
});

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
