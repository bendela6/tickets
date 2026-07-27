import { cn } from '@tickets/ui';

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

type RelativeDateProps = {
  value: string;
  now?: Date;
  /** Style overdue past dates in danger (for due-date fields). */
  overdue?: boolean;
  className?: string;
};

export function RelativeDate({ value, now = new Date(), overdue, className }: RelativeDateProps) {
  return (
    <span
      title={formatExact(value)}
      className={cn('font-sans text-ui', overdue ? 'text-danger' : 'text-ink-2', className)}
    >
      {relativeLabel(value, now)}
    </span>
  );
}
