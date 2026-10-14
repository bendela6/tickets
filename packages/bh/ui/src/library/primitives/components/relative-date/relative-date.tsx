import { cn } from '../../../../style/cn';
import { readableLocale, type DateLocaleOptions } from './date-locale';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/**
 * A date as whole calendar days from `now`, counted in UTC: `today`,
 * `tomorrow`, `yesterday`, `in 3 days`, `2 days ago`. Given a `locale`, in
 * that locale's words, its own for the near days too: `vorgestern` in `de`.
 *
 * @param value The date, as a string `new Date()` reads, such as an ISO timestamp.
 * @param now The moment to count from.
 * @param options The language to write in.
 */
export function relativeLabel(value: string, now: Date, { locale }: DateLocaleOptions = {}) {
  const days = Math.round((toUtcMidnight(new Date(value)) - toUtcMidnight(now)) / 86_400_000);
  const format =
    locale === undefined
      ? null
      : cached(RELATIVE, locale, (readable) => {
          return new Intl.RelativeTimeFormat(readable, { numeric: 'auto' });
        });
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
  /** Style overdue past dates in danger (for due-date fields). */
  overdue?: boolean;
  /** Added to the `<span>`'s own classes. */
  className?: string;
}

/** Shows a date as days from now (`today`, `in 3 days`, `2 days ago`), with the exact date as its title. */
export function RelativeDate({
  value,
  now = new Date(),
  locale,
  overdue,
  className,
}: RelativeDateProps) {
  return (
    <span
      title={formatExact(value, { locale })}
      className={cn('text-13/19 font-sans', overdue ? 'text-red-9' : 'text-gray-11', className)}
    >
      {relativeLabel(value, now, { locale })}
    </span>
  );
}
