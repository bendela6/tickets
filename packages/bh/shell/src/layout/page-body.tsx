// A page's body: its content in a column, in the page's gutters, at the full
// width of the page. Every page typed the same div out; this is that div.

import type { ReactNode } from 'react';
import { cn } from '@bh/ui';
import { PAGE_GUTTERS } from './gutters';

/** Props for PageBody component. */
export interface PageBodyProps {
  /** The content, top to bottom, 16 pixels apart: sections, cards, a table. */
  children: ReactNode;
  /**
   * Added to its classes, where it wins over them: `flex-1` for a body that
   * fills the rest of the page's height.
   */
  className?: string;
}

/**
 * A page's body: its content in a column 16 pixels apart, in the page's
 * gutters, the full width of the page.
 *
 * No width cap: every page runs the width of the window, and what must not,
 * a form's field or a line of prose, sets its own. `min-w-0` lets a wide
 * table inside it scroll in its own frame instead of widening the page.
 */
export function PageBody({ children, className }: PageBodyProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-16', PAGE_GUTTERS, className)}>{children}</div>
  );
}
