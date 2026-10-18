import { describe, expect, it } from 'vitest';
import { formatDuration } from './duration';

/** The writer DurationInput had before it took a unit, which took minutes only. */
function minutesAsBefore(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest}m`;
  }
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

describe('formatDuration in minutes, the default', () => {
  it('drops the empty half rather than padding it', () => {
    expect(formatDuration(150)).toBe('2h 30m');
    expect(formatDuration(180)).toBe('3h');
    expect(formatDuration(45)).toBe('45m');
  });

  it('shows a stored zero rather than nothing', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('writes every whole number of minutes as it did before it took a unit', () => {
    for (let minutes = 0; minutes <= 3000; minutes += 1) {
      expect(formatDuration(minutes)).toBe(minutesAsBefore(minutes));
    }
  });

  it('counts past a day in hours, so an estimate reads as one', () => {
    expect(formatDuration(1590)).toBe('26h 30m');
  });

  it('writes a part of a minute as seconds', () => {
    expect(formatDuration(1.5)).toBe('1m 30s');
    expect(formatDuration(0.5)).toBe('30s');
  });
});

describe('formatDuration in milliseconds', () => {
  const ms = (value: number) => formatDuration(value, { unit: 'ms' });

  it('writes milliseconds under a second', () => {
    expect(ms(1)).toBe('1ms');
    expect(ms(840)).toBe('840ms');
    expect(ms(412.4)).toBe('412ms');
  });

  it('writes seconds to a tenth under ten seconds, and whole ones under a minute', () => {
    expect(ms(1000)).toBe('1s');
    expect(ms(1400)).toBe('1.4s');
    expect(ms(2900)).toBe('2.9s');
    expect(ms(15_300)).toBe('15s');
    expect(ms(59_000)).toBe('59s');
  });

  it('writes minutes and seconds under an hour, a zero second part left off', () => {
    expect(ms(86_000)).toBe('1m 26s');
    expect(ms(125_000)).toBe('2m 5s');
    expect(ms(300_000)).toBe('5m');
  });

  it('writes hours and minutes from an hour, the seconds left off', () => {
    expect(ms(3_600_000)).toBe('1h');
    expect(ms(7_529_000)).toBe('2h 5m');
    expect(ms(76 * 3_600_000 + 5 * 60_000)).toBe('76h 5m');
  });

  it('moves up a unit when the rounding reaches it', () => {
    expect(ms(999.6)).toBe('1s');
    expect(ms(9960)).toBe('10s');
    expect(ms(59_600)).toBe('1m');
    expect(ms(3_599_600)).toBe('1h');
  });

  it('writes zero in milliseconds', () => {
    expect(ms(0)).toBe('0ms');
  });
});

describe('formatDuration in other units', () => {
  it('reads seconds', () => {
    expect(formatDuration(7500, { unit: 's' })).toBe('2h 5m');
    expect(formatDuration(42, { unit: 's' })).toBe('42s');
    expect(formatDuration(0, { unit: 's' })).toBe('0s');
  });

  it('reads hours', () => {
    expect(formatDuration(2.5, { unit: 'h' })).toBe('2h 30m');
    expect(formatDuration(0, { unit: 'h' })).toBe('0h');
  });

  it('reads a unit it does not know as minutes', () => {
    // A format's options can come from data, where the type does not reach.
    expect(formatDuration(150, { unit: 'weeks' as 'h' })).toBe('2h 30m');
    expect(formatDuration(0, { unit: 'toString' as 'h' })).toBe('0m');
  });
});

describe('formatDuration with days', () => {
  const long = (value: number) => formatDuration(value, { unit: 'ms', days: true });

  it('counts whole days and hours past a day', () => {
    expect(long(76 * 3_600_000)).toBe('3d 4h');
    expect(long(48 * 3_600_000)).toBe('2d');
    expect(formatDuration(1580, { days: true })).toBe('1d 2h');
  });

  it('rounds to the nearest hour past a day, as it rounds every last unit', () => {
    expect(formatDuration(1590, { days: true })).toBe('1d 3h');
  });

  it('writes less than a day as it would without them', () => {
    expect(long(23 * 3_600_000 + 50 * 60_000)).toBe('23h 50m');
    expect(long(86_000)).toBe('1m 26s');
  });

  it('moves up to a day when the rounding reaches it', () => {
    expect(long(24 * 3_600_000 - 20_000)).toBe('1d');
  });
});

describe('formatDuration at the edges', () => {
  it('keeps the sign of a negative length', () => {
    expect(formatDuration(-30)).toBe('-30m');
    expect(formatDuration(-1400, { unit: 'ms' })).toBe('-1.4s');
    expect(formatDuration(-0.2, { unit: 'ms' })).toBe('0ms');
  });

  it('hands back a number that is not finite as String writes it', () => {
    expect(formatDuration(Number.NaN)).toBe('NaN');
    expect(formatDuration(Number.POSITIVE_INFINITY, { unit: 'ms' })).toBe('Infinity');
  });
});
