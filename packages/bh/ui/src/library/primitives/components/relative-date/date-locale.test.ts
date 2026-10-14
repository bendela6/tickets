import { expect, it } from 'vitest';
import { readableLocale } from './date-locale';

it('passes a BCP 47 tag through as given, and drops one Intl cannot read', () => {
  expect(readableLocale('ka')).toBe('ka');
  expect(readableLocale('en-GB')).toBe('en-GB');
  expect(readableLocale(undefined)).toBeUndefined();
  expect(readableLocale('en_US')).toBeUndefined();
  expect(readableLocale('')).toBeUndefined();
});
