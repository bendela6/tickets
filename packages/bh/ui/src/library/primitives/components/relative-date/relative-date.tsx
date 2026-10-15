import { useState } from 'react';
import { useNow } from '@bh/hooks';
import { cn } from '../../../../style/cn';
import { readableLocale, type DateLocaleOptions } from './date-locale';
import { formatDateTime } from './format-date-time';

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

/**
 * How often a label in minutes and hours, `distance` from now, can change:
 * each minute under an hour, each hour under a day, and never beyond, where
 * it counts days. 0 is never, which `useNow` takes as no timer at all.
 */
function tickFor(distance: number) {
  const away = Math.abs(distance);
  if (away < HOUR) {
    return MINUTE;
  }
  return away < DAY ? HOUR : 0;
}

/**
 * The time a label in minutes and hours counts from, ticking only as fast as
 * the label can change, or not at all while not `live`. Every label on the
 * page at one step shares `useNow`'s one timer for it.
 */
function useLabelClock(value: string, live: boolean): number {
  const at = new Date(value).getTime();
  const [step, setStep] = useState(() => (live ? tickFor(at - Date.now()) : 0));
  const now = useNow({ interval: step });
  const wanted = live ? tickFor(at - now) : 0;
  if (wanted !== step) {
    // The label has moved into the next step, an hour or a day away, and its
    // clock moves with it: kept from the render before, as React's derived
    // state is, so the timer changes before anything is drawn.
    setStep(wanted);
  }
  return now;
}

interface RelativeDateProps {
  /** The date, as a string `new Date()` reads, such as an ISO timestamp. */
  value: string;
  /** The moment to count from. Unset, the current time. */
  now?: Date;
  /**
   * The locale to write in, as a BCP 47 tag such as `ka` or `de`: the label
   * and its title in that language. Unset, English.
   */
  locale?: string;
  /**
   * The smallest step it counts in. `day`, the default, for a day such as a
   * due date: whole calendar days, with the date as its title. `minute` for
   * a moment such as when something was saved: under a day away it reads
   * `just now`, `5 minutes ago` or `in 2 hours`, keeps itself current while
   * `now` is unset, and has the date and time as its title.
   */
  smallestUnit?: 'day' | 'minute';
  /** Style overdue past dates in danger (for due-date fields). */
  overdue?: boolean;
  /** Added to the `<span>`'s own classes. */
  className?: string;
}

/**
 * Shows a date as days from now (`today`, `in 3 days`, `2 days ago`), or with
 * `smallestUnit="minute"` a moment as minutes and hours (`5 minutes ago`),
 * with the exact date, or the date and time, as its title.
 */
export function RelativeDate({
  value,
  now,
  locale,
  smallestUnit = 'day',
  overdue,
  className,
}: RelativeDateProps) {
  const inMinutes = smallestUnit === 'minute';
  const clock = useLabelClock(value, inMinutes && now === undefined);
  // In days it reads the time as it draws, as it always has: a day label
  // changes only at midnight, and keeps no timer for it.
  const from = now ?? (inMinutes ? new Date(clock) : new Date());
  return (
    <span
      title={inMinutes ? formatDateTime(value, { locale }) : formatExact(value, { locale })}
      className={cn('text-13/19 font-sans', overdue ? 'text-red-9' : 'text-gray-11', className)}
      // Unless given `now`, a server draws the label at its own time and the
      // title in its own zone, and the browser's may differ: no fault, as
      // useNow's own rule says.
      suppressHydrationWarning={now === undefined}
    >
      {relativeLabel(value, from, { locale, smallestUnit })}
    </span>
  );
}
