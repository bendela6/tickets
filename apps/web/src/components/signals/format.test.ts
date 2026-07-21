import { describe, expect, test } from 'vitest';
import { formatBytes, formatCount, formatDate, formatDurationMs, relativeTime } from './format';

describe('formatCount', () => {
  test('groups thousands, never abbreviates', () => {
    expect(formatCount(7)).toBe('7');
    expect(formatCount(342)).toBe('342');
    expect(formatCount(1204)).toBe('1,204');
    expect(formatCount(4213)).toBe('4,213');
  });
});

describe('relativeTime', () => {
  const NOW = new Date('2026-07-21T12:00:00Z');

  test('minutes', () => {
    expect(relativeTime('2026-07-21T11:58:00Z', NOW)).toBe('2m');
  });

  test('tens of minutes', () => {
    expect(relativeTime('2026-07-21T11:19:00Z', NOW)).toBe('41m');
  });

  test('hours', () => {
    expect(relativeTime('2026-07-21T09:00:00Z', NOW)).toBe('3h');
  });

  test('days', () => {
    expect(relativeTime('2026-07-09T12:00:00Z', NOW)).toBe('12d');
  });
});

describe('formatBytes', () => {
  test('formats gigabytes to one decimal', () => {
    expect(formatBytes(2_252_000_000)).toBe('2.1 GB');
  });

  test('formats bytes under 1024 with no unit conversion', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  test('formats zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('formats kilobytes with one decimal', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  test('rounds up through a unit boundary instead of showing "1024 KB"', () => {
    expect(formatBytes(1_048_570)).toBe('1.0 MB');
  });

  test('rounds up through the MB->GB boundary the same way', () => {
    expect(formatBytes(1_073_741_818)).toBe('1.0 GB');
  });
});

describe('formatDate', () => {
  test('formats a UTC iso timestamp regardless of host timezone', () => {
    expect(formatDate('2026-03-12T00:00:00Z')).toBe('Mar 12, 2026');
  });

  test('zero-pads single-digit days', () => {
    expect(formatDate('2026-04-02T00:00:00Z')).toBe('Apr 02, 2026');
  });
});

describe('formatDurationMs', () => {
  test('minutes and seconds', () => {
    expect(formatDurationMs(86_000)).toBe('1m 26s');
  });

  test('seconds only', () => {
    expect(formatDurationMs(4_000)).toBe('4s');
  });

  test('hours and minutes', () => {
    expect(formatDurationMs(3_725_000)).toBe('1h 02m');
  });

  test('zero-pads single-digit seconds in the minutes branch', () => {
    expect(formatDurationMs(64_000)).toBe('1m 04s');
  });
});
