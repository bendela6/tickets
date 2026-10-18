import { useState } from 'react';
import { useNow } from '@bh/hooks';
import { formatDateTime, formatExact, relativeLabel } from '@bh/template';
import { cn } from '../../../../style/cn';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

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
