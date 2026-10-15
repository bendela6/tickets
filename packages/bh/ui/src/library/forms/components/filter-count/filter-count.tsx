import type { FilterCountProps } from '@bh/form';
import { cn } from '../../../../style';
import { Spinner } from '../../../feedback/components/spinner';

const NUMBER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** A count in IBM Plex Mono, as the design sets every number in a bar. */
function Count({ value, className }: { value: number; className?: string }) {
  return <span className={cn('font-mono tabular-nums', className)}>{NUMBER.format(value)}</span>;
}

/**
 * How many rows a filter lets through: "12 of 40 items", or "40 items" when
 * it lets every one through. "Counting" with a spinner while it is asked
 * for, and the count in the danger tone when nothing matches. A filter
 * form's `count` slot draws it; it is the registry's `filter.count`.
 */
export function FilterCount({ shown, total, label, loading }: FilterCountProps) {
  // The rows' name agrees with the number it follows: the total, or the
  // count when there is no total to give.
  const last = total ?? shown;
  const noun = last === 1 ? label.one : label.other;
  // One number when there is one to give, or when the filter lets every row
  // through; else the count of the total.
  const one =
    shown === undefined || total === undefined || shown === total ? (shown ?? total) : undefined;
  const nothing = shown === undefined && total === undefined;
  // Nothing matches: the whole count in the danger tone, as the design draws it.
  const none = !loading && (one ?? shown) === 0;
  return (
    // Polite: a count that changes with each keystroke shouldn't cut in on
    // what a screen reader is saying.
    <output
      aria-live="polite"
      // Busy while it counts: a screen reader hears the count, not "Counting".
      aria-busy={loading || undefined}
      // An inline row puts it at its end, before the form's buttons.
      data-row-end=""
      className={cn(
        'text-12 inline-flex shrink-0 items-center gap-6 font-sans whitespace-nowrap',
        none ? 'text-red-11' : 'text-gray-11',
      )}
    >
      {loading ? (
        <>
          <Spinner size="xs" tone="primary" label="" />
          Counting
        </>
      ) : nothing ? null : one === undefined ? (
        <span>
          <Count value={shown ?? 0} className={none ? undefined : 'text-gray-12'} /> of{' '}
          <Count value={total ?? 0} /> {noun}
        </span>
      ) : (
        <span>
          <Count value={one} className={none ? undefined : 'text-gray-12'} /> {noun}
        </span>
      )}
    </output>
  );
}
