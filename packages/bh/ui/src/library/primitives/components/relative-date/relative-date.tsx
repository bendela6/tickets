import { cn } from '../../../../style/cn';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toUtcMidnight(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatExact(value: string) {
  const date = new Date(value);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function relativeLabel(value: string, now: Date) {
  const days = Math.round((toUtcMidnight(new Date(value)) - toUtcMidnight(now)) / 86_400_000);
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
  /** Style overdue past dates in danger (for due-date fields). */
  overdue?: boolean;
  /** Added to the `<span>`'s own classes. */
  className?: string;
}

/** Shows a date as days from now (`today`, `in 3 days`, `2 days ago`), with the exact date as its title. */
export function RelativeDate({ value, now = new Date(), overdue, className }: RelativeDateProps) {
  return (
    <span
      title={formatExact(value)}
      className={cn('text-13/19 font-sans', overdue ? 'text-red-9' : 'text-gray-11', className)}
    >
      {relativeLabel(value, now)}
    </span>
  );
}
