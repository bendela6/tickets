// The page frame: an optional header on top and an edge-to-edge body under it.

import type { ReactNode } from 'react';

/** Props for Page component. */
export interface PageProps {
  /** Drawn above the body: a PageHeader, as a rule. */
  header?: ReactNode;
  /** The body, edge to edge and unpadded: a PageBody or a CardGrid, as a rule. */
  children: ReactNode;
}

/**
 * A page's frame: its header above, its body below, filling the shell's `<main>`.
 *
 * Header above, body below, and no scroll container of its own: the body creates
 * no scrollport, so its overflow propagates to the shell's `<main>` and the whole
 * page scrolls — header included. That is what lets a table's sticky column
 * header and bottom dock pin to the viewport instead of to a band inside it.
 *
 * The body is also unpadded. A page puts its content in a PageBody, or its
 * cards in a CardGrid, which add the gutters PageHeader pads by, so the title
 * and the content line up at both widths.
 */
export function Page({ header, children }: PageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
