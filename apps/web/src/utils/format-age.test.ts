import { expect, test } from 'vitest';
import { formatAge } from './format-age';

const now = new Date('2026-07-16T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

test('formats seconds, minutes, hours, and days', () => {
  expect(formatAge(ago(5_000), now)).toBe('5s');
  expect(formatAge(ago(40 * 60_000), now)).toBe('40m');
  expect(formatAge(ago(2 * 3_600_000), now)).toBe('2h');
  expect(formatAge(ago(3 * 86_400_000), now)).toBe('3d');
});

test('clamps future timestamps to 0s rather than going negative', () => {
  expect(formatAge(new Date(now.getTime() + 10_000).toISOString(), now)).toBe('0s');
});
