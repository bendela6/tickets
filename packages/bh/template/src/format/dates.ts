import { readableLocale, type DateLocaleOptions } from './date-locale';

// The date helpers without React: a date written out, and a date counted from
// now. RelativeDate (@bh/ui) draws them, and the date formats of the format
// registry write them, in a browser and on a server alike.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function toUtcMidnight(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Each locale's formatter, built once: a list of dates calls these once a row.
// `null` marks a tag `Intl` cannot read, which writes bh's English instead.
const EXACT = new Map<string, Intl.DateTimeFormat | null>();
const RELATIVE = new Map<string, Intl.RelativeTimeFormat | null>();

function cached<T>(cache: Map<string, T | null>, locale: string, build: (locale: string) => T) {
  let format = cache.get(locale);
  if (format === undefined) {
    const readable = readableLocale(locale);
    format = readable === undefined ? null : build(readable);
    cache.set(locale, format);
  }
  return format;
}

/**
 * A date as `Jul 13, 2026`: its calendar day in UTC. Given a `locale`, that
 * locale's medium date, still in UTC: `13 Jul 2026` in `en-GB`.
 *
 * @param value The date, as a string `new Date()` reads, such as an ISO timestamp.
 * @param options The language to write in.
 */
export function formatExact(value: string, { locale }: DateLocaleOptions = {}) {
  const date = new Date(value);
  const format =
    locale === undefined
      ? null
      : cached(EXACT, locale, (readable) => {
          return new Intl.DateTimeFormat(readable, { dateStyle: 'medium', timeZone: 'UTC' });
        });
  if (format !== null) {
    // `Intl` throws on an invalid date, where the English below writes NaN.
    return Number.isNaN(date.getTime()) ? value : format.format(date);
  }
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** How `relativeLabel` counts, and the language it writes in. */
export interface RelativeLabelOptions extends DateLocaleOptions {
  /**
   * The smallest step it counts in. `day`, the default, counts whole
   * calendar days in UTC, as a due date wants: `today`, `in 3 days`.
   * `minute` counts a moment less than a day away in whole minutes and
   * hours, as the time something was saved wants: `just now`,
   * `5 minutes ago`, `in 2 hours`; a day or more away, it counts days as
   * `day` does.
   */
  smallestUnit?: 'day' | 'minute';
}

// A moment less than a day away, in whole minutes or hours: counted down, so
// `5 minutes ago` is five minutes gone and not yet six, as most of the apps
// counted. Under a whole minute either way is `just now`, which also keeps a
// moment a server stamped a few seconds ahead of the reader's clock from
// reading `in 0 minutes`.
function minutesOrHours(distance: number, format: Intl.RelativeTimeFormat | null) {
  const away = Math.abs(distance);
  if (away < MINUTE) {
    return format === null ? 'just now' : format.format(0, 'second');
  }
  const unit = away < HOUR ? 'minute' : 'hour';
  const count = Math.floor(away / (unit === 'minute' ? MINUTE : HOUR));
  if (format !== null) {
    return format.format(distance < 0 ? -count : count, unit);
  }
  const words = `${count} ${unit}${count === 1 ? '' : 's'}`;
  return distance < 0 ? `${words} ago` : `in ${words}`;
}

/**
 * A date as whole calendar days from `now`, counted in UTC: `today`,
 * `tomorrow`, `yesterday`, `in 3 days`, `2 days ago`. With `smallestUnit:
 * 'minute'`, a moment less than a day away reads in whole minutes and hours
 * instead: `just now`, `5 minutes ago`, `in 2 hours`. Given a `locale`, in
 * that locale's words, its own for the near days too: `vorgestern` and
 * `vor 5 Minuten` in `de`.
 *
 * @param value The date, as a string `new Date()` reads, such as an ISO timestamp.
 * @param now The moment to count from.
 * @param options The smallest step it counts in, and the language to write in.
 */
export function relativeLabel(
  value: string,
  now: Date,
  { locale, smallestUnit = 'day' }: RelativeLabelOptions = {},
) {
  const date = new Date(value);
  const format =
    locale === undefined
      ? null
      : cached(RELATIVE, locale, (readable) => {
          return new Intl.RelativeTimeFormat(readable, { numeric: 'auto' });
        });
  const distance = date.getTime() - now.getTime();
  // An unreadable date's distance is NaN, under no step: it goes on to the days.
  if (smallestUnit === 'minute' && Math.abs(distance) < DAY) {
    return minutesOrHours(distance, format);
  }
  const days = Math.round((toUtcMidnight(date) - toUtcMidnight(now)) / DAY);
  if (format !== null) {
    // `Intl` throws on NaN days, where the English below writes them.
    return Number.isNaN(days) ? value : format.format(days, 'day');
  }
  if (days === 0) {
    return 'today';
  }
  if (days === 1) {
    return 'tomorrow';
  }
  if (days === -1) {
    return 'yesterday';
  }
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
