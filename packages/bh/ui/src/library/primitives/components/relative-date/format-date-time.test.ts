import { describe, expect, it } from 'vitest';
import { formatDateTime } from './format-date-time';
import { formatExact } from './relative-date';

const AT = '2026-07-13T09:05:30Z';

/** The zone this run's `Date` reads in, which the default follows. */
const HERE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('formatDateTime', () => {
  it('writes the date as formatExact does, then a 24-hour time', () => {
    expect(formatDateTime(AT, { timeZone: 'UTC' })).toBe('Jul 13, 2026, 09:05');
    expect(formatDateTime('2026-07-13T21:40:00Z', { timeZone: 'UTC' })).toBe('Jul 13, 2026, 21:40');
    expect(formatDateTime(AT, { timeZone: 'UTC' })).toMatch(new RegExp(`^${formatExact(AT)}, `));
  });

  it('writes half past midnight as 00:30, never 24:30 or 12:30 AM', () => {
    expect(formatDateTime('2026-07-13T00:30:00Z', { timeZone: 'UTC' })).toBe('Jul 13, 2026, 00:30');
  });

  it('shows the seconds when asked', () => {
    expect(formatDateTime(AT, { timeZone: 'UTC', seconds: true })).toBe('Jul 13, 2026, 09:05:30');
  });

  it('reads the clock in a named zone, the day moving with it', () => {
    expect(formatDateTime(AT, { timeZone: 'Asia/Tbilisi' })).toBe('Jul 13, 2026, 13:05');
    expect(formatDateTime('2026-07-13T02:00:00Z', { timeZone: 'America/New_York' })).toBe(
      'Jul 12, 2026, 22:00',
    );
  });

  it("reads the clock in the reader's own zone by default", () => {
    expect(formatDateTime(AT)).toBe(formatDateTime(AT, { timeZone: HERE }));
  });

  it("falls back to the reader's own zone for a zone it does not know", () => {
    expect(formatDateTime(AT, { timeZone: 'Nowhere/Atlantis' })).toBe(formatDateTime(AT));
  });

  it('takes a Date as well as a string', () => {
    expect(formatDateTime(new Date(AT), { timeZone: 'UTC' })).toBe('Jul 13, 2026, 09:05');
  });

  it('hands back a string no Date can read as it was written', () => {
    expect(formatDateTime('not a date')).toBe('not a date');
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(new Date(Number.NaN))).toBe('Invalid Date');
  });
});

describe('formatDateTime with a locale', () => {
  it("writes the locale's medium date and short time", () => {
    expect(formatDateTime(AT, { locale: 'en-GB', timeZone: 'UTC' })).toBe('13 Jul 2026, 09:05');
    expect(formatDateTime(AT, { locale: 'de', timeZone: 'UTC' })).toBe('13.07.2026, 09:05');
    expect(formatDateTime(AT, { locale: 'ka', timeZone: 'UTC' })).toBe('13 ივლ. 2026, 09:05');
  });

  it("keeps the locale's own clock, where bh's own is 24-hour", () => {
    expect(formatDateTime('2026-07-13T14:30:00Z', { locale: 'en-US', timeZone: 'UTC' })).toMatch(
      /^Jul 13, 2026, 2:30\sPM$/,
    );
    expect(formatDateTime('2026-07-13T14:30:00Z', { timeZone: 'UTC' })).toBe('Jul 13, 2026, 14:30');
  });

  it('shows the seconds and reads the named zone in a locale too', () => {
    expect(formatDateTime(AT, { locale: 'de', timeZone: 'Asia/Tbilisi', seconds: true })).toBe(
      '13.07.2026, 13:05:30',
    );
  });

  it("ignores a tag Intl cannot read, writing bh's own", () => {
    expect(formatDateTime(AT, { locale: 'en_US', timeZone: 'UTC' })).toBe('Jul 13, 2026, 09:05');
  });

  it('keeps the zone when the locale is the part it cannot read, and the reverse', () => {
    expect(formatDateTime(AT, { locale: 'de', timeZone: 'Nowhere/Atlantis' })).toBe(
      formatDateTime(AT, { locale: 'de' }),
    );
    expect(formatDateTime(AT, { locale: 'en_US', timeZone: 'Asia/Tbilisi' })).toBe(
      'Jul 13, 2026, 13:05',
    );
  });
});
