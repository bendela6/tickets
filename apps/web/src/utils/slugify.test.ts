import { expect, test } from 'vitest';
import { slugify } from './slugify';

test('lower-cases a name and joins its words with hyphens', () => {
  expect(slugify('In review')).toBe('in-review');
  expect(slugify("Won't fix")).toBe('won-t-fix');
  expect(slugify('Relates to  (both ways)')).toBe('relates-to-both-ways');
});

test('drops separators at either end', () => {
  expect(slugify('  -- Blocked! ')).toBe('blocked');
  expect(slugify('???')).toBe('');
});

test("takes underscores for a field's key", () => {
  expect(slugify('Target date', '_')).toBe('target_date');
  expect(slugify(' _Severity (P0) ', '_')).toBe('severity_p0');
});
