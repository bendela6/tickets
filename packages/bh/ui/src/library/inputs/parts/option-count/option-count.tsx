import { cn } from '../../../../style';

export interface OptionCountProps {
  /** How many rows hold the option. */
  count: number;
  className?: string;
}

/**
 * An option's count, after its label: how many rows hold it, in IBM Plex Mono
 * at 11px, in its label's color, muted. Drawn by `ToggleChips` and
 * `SegmentedControl` beside the label, and by the list controls' rows.
 *
 * A space comes first, so the option is named "Active 9" and not "Active9";
 * a flex row draws no text that is only blank, so it changes nothing on
 * screen.
 */
export function OptionCount({ count, className }: OptionCountProps) {
  return (
    <>
      {' '}
      <span className={cn('text-11 font-400 font-mono tabular-nums opacity-75', className)}>
        {count}
      </span>
    </>
  );
}
