// A page's grid of cards. One column on the phone, two above md, with the
// page's own gutters, so every card sits in the same rhythm whichever feature
// drew it.

import type { ReactNode } from 'react';
import { cn } from '@bh/ui';
import { PAGE_GUTTERS } from './gutters';

/** Props for CardGrid component. */
export interface CardGridProps {
  /** The cards, one per cell. */
  children: ReactNode;
}

/**
 * A page body's grid of cards: one column on a phone, two from md, 16px apart, in the page's gutters.
 *
 * The gutters are PageBody's, so its cards line up with the content of any
 * other page.
 */
export function CardGrid({ children }: CardGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-16 md:grid-cols-2', PAGE_GUTTERS)}>{children}</div>
  );
}
