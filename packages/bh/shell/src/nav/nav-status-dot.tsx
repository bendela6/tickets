// A destination's status as a 6px dot and, for a screen reader, as words.
// Deliberately still: a pulsing dot per row would make the whole sidebar move.

import { cn } from '@bh/ui';
import { NAV_STATUS } from './nav-status';
import type { NavStatus } from './nav-types';

/** Props for NavStatusDot component. */
export interface NavStatusDotProps {
  /** Which of the four: its tone and its words come from NAV_STATUS. */
  status: NavStatus;
  /** Classes on the wrapper, to place it: the rail sets it on the icon's corner. */
  className?: string;
}

/** A status as a still 6px dot, and as words to a screen reader ("Up, with warnings"). */
export function NavStatusDot({ status, className }: NavStatusDotProps) {
  const { tone, label } = NAV_STATUS[status];
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <span aria-hidden className={cn('size-6 rounded-full', tone)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
