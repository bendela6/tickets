// A moment written out in full, date and time of day: `Jul 13, 2026, 09:05`.
//
// The apps each wrote their own: tickets glued `formatExact` to a UTC clock,
// cv kept an en-GB formatter in the reader's zone, signals a UTC date and a
// UTC clock side by side, wallet-passes a medium date and short time in a
// business's zone. What they share is the date as `formatExact` writes it, a
// 24-hour clock, sometimes the seconds, and a zone the caller picks.
//
// The date is `formatExact`'s, so a date-time and a date in the same list
// read alike. The zone is the reader's own unless one is named: a calendar
// day is the same everywhere, which is why `formatExact` and `RelativeDate`
// count in UTC, but a time of day read in UTC is right only for a reader in
// London in winter.

import { readableLocale, type DateLocaleOptions } from './date-locale';

/** How `formatDateTime` writes a moment. */
export interface FormatDateTimeOptions extends DateLocaleOptions {
  /**
   * The zone the clock reads in: `UTC`, or an IANA zone such as
   * `Europe/Tbilisi` for a place's own clock. Unset, the reader's own zone.
   *
   * A zone the runtime does not know falls back to the reader's own, so a
   * zone that comes from data cannot take the screen down.
   */
  timeZone?: string;
  /** Show the seconds: `09:05:30` rather than `09:05`. */
  seconds?: boolean;
}

// Building an `Intl.DateTimeFormat` costs far more than using one, and a
// table calls this once a cell; the options are few, so each is built once.
const FORMATS = new Map<string, Intl.DateTimeFormat>();

function build(locale: string | undefined, timeZone: string | undefined, seconds: boolean) {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: seconds ? 'medium' : 'short',
    // bh's own clock is 24-hour, from `00:30` to `23:59`: `h23`, since
    // `hour12: false` has written half past midnight as `24:30` in some
    // runtimes. A locale brings its own, as `2:30 PM` in `en-US`.
    ...(locale === undefined ? { hourCycle: 'h23' } : {}),
  };
  try {
    return new Intl.DateTimeFormat(locale ?? 'en-US', {
      ...options,
      ...(timeZone === undefined ? {} : { timeZone }),
    });
  } catch {
    // RangeError: a zone this runtime does not know.
    return new Intl.DateTimeFormat(locale ?? 'en-US', options);
  }
}

function formatterFor(
  locale: string | undefined,
  timeZone: string | undefined,
  seconds: boolean,
): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${timeZone ?? ''}|${seconds}`;
  let format = FORMATS.get(key);
  if (format === undefined) {
    format = build(readableLocale(locale), timeZone, seconds);
    FORMATS.set(key, format);
  }
  return format;
}

/**
 * A moment as its date and time of day, `Jul 13, 2026, 09:05`, on a 24-hour
 * clock in the reader's zone unless `timeZone` names another. The date is
 * written as `formatExact` writes it. Given a `locale`, that locale's
 * medium date and short time: `13 Jul 2026, 09:05` in `en-GB`,
 * `Jul 13, 2026, 9:05 AM` in `en-US`.
 *
 * A string no `Date` can read comes back as it was written, where `Intl`
 * would throw; an invalid `Date` comes back as `Invalid Date`.
 *
 * @param value The moment: a `Date`, or a string `new Date()` reads, such as an ISO timestamp.
 * @param options The language, the zone the clock reads in, and whether it shows seconds.
 */
export function formatDateTime(
  value: string | Date,
  { locale, timeZone, seconds = false }: FormatDateTimeOptions = {},
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return formatterFor(locale, timeZone, seconds).format(date);
}
