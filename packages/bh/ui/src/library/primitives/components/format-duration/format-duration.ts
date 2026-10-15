// A length of time as a person reads it: `840ms`, `2.9s`, `1m 26s`, `2h 30m`.
//
// It began as DurationInput's writer, which took minutes: `150` is `2h 30m`.
// The apps that time things count in milliseconds and each wrote their own:
// items-core's log wrote `412ms`, `2.9s`, `1m30s`, `2h5m`; its run tables
// `840ms`, `1.4s`, `2m 5s`, and minutes past an hour; its crawls `45s`, `12m`,
// `2h 5m`, `3d 4h`; signals `12s`, `1m 26s`, `2h 05m`; session-board `45m`,
// `2h05`, `3d`. What they share is the two largest units, a part that is zero
// left off, and the smallest unit a person cares about at that length.
//
// So the number keeps the unit it was counted in, named by `unit`, and the
// writing is the same for every unit. Minutes stay the default, which is
// what DurationInput holds and what this always took: every whole number of
// minutes is written as it was.

/** What a duration's number counts. */
const UNITS = {
  ms: { ms: 1, zero: '0ms' },
  s: { ms: 1000, zero: '0s' },
  min: { ms: 60_000, zero: '0m' },
  h: { ms: 3_600_000, zero: '0h' },
} as const;

/** How `formatDuration` reads a number and writes it. */
export interface FormatDurationOptions {
  /**
   * What the number counts: `ms`, `s`, `min` or `h`. Minutes unless given,
   * as DurationInput holds them; a time measured with `Date.now()` or
   * `performance.now()` is `ms`.
   */
  unit?: 'ms' | 's' | 'min' | 'h';
  /**
   * Count whole days past a day: `3d 4h` rather than `76h`. Off unless
   * given, so a length of work, an estimate or time spent, reads in hours.
   */
  days?: boolean;
}

/** Two units, the second left off when it is zero: `2h 5m`, `3h`. */
function pair(major: number, majorUnit: string, minor: number, minorUnit: string): string {
  return minor === 0 ? `${major}${majorUnit}` : `${major}${majorUnit} ${minor}${minorUnit}`;
}

/** A length in milliseconds, no sign, in the units its size calls for. */
function written(ms: number, days: boolean): string {
  // Each step rounds first and compares after, so a length that rounds up
  // to the next unit is written in it: `59.6s` is `1m`, never `60s`.
  const millis = Math.round(ms);
  if (millis < 1000) {
    return `${millis}ms`;
  }
  const tenths = Math.round(ms / 100);
  if (tenths < 100) {
    return `${tenths / 10}s`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return pair(Math.floor(seconds / 60), 'm', seconds % 60, 's');
  }
  const minutes = Math.round(ms / 60_000);
  if (!days || minutes < 1440) {
    return pair(Math.floor(minutes / 60), 'h', minutes % 60, 'm');
  }
  const hours = Math.round(ms / 3_600_000);
  return pair(Math.floor(hours / 24), 'd', hours % 24, 'h');
}

/**
 * A length of time in the two largest units it needs, a zero second part
 * left off: `150` is `2h 30m`, `45` is `45m`, `180` is `3h`. The number is
 * minutes unless `unit` says otherwise: `86000` with `unit: 'ms'` is
 * `1m 26s`.
 *
 * Under a second it is milliseconds, `840ms`; under ten seconds, seconds to
 * a tenth, `2.9s`; under a minute, whole seconds, `15s`; under an hour,
 * minutes and seconds, `1m 26s`; then hours and minutes, `76h 5m`, or with
 * `days`, days and hours past a day, `3d 4h`.
 *
 * Zero is written in the unit it was counted in, `0m` for minutes, not an
 * empty string: a stored zero is a real answer and has to look different
 * from nothing having been entered. A negative length keeps its sign; a
 * number that is not finite comes back as `String` writes it.
 *
 * @param value The length, in `unit`s.
 * @param options What the number counts, and whether past a day is written in days.
 */
export function formatDuration(
  value: number,
  { unit = 'min', days = false }: FormatDurationOptions = {},
): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  // Read so a `unit` that came from data and names none of these is minutes.
  const scale = Object.hasOwn(UNITS, unit) ? UNITS[unit] : UNITS.min;
  if (value === 0) {
    return scale.zero;
  }
  const text = written(Math.abs(value) * scale.ms, days);
  return value < 0 && text !== '0ms' ? `-${text}` : text;
}
