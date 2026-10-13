// A titled block inside a page body: the caption row, and the content under it.
// Instrument's SectionHeader draws the caption, so a section here is the
// spacing and the heading level, nothing more.

import type { ReactNode } from 'react';
import { cn, SectionHeader } from '@bh/ui';

/** Props for Section component. */
export interface SectionProps {
  /** The caption, drawn in uppercase as an `h2`. */
  title: ReactNode;
  /** A count, a total, a hint: rendered beside the title at caption size. */
  count?: ReactNode;
  /** At the right end of the caption row: a button or a link. */
  action?: ReactNode;
  /** The content, 8px under the caption. */
  children: ReactNode;
  /** Classes on the `<section>`, for its place in the body. */
  className?: string;
}

/**
 * A titled block in a page's body: a caption row, and its content under it.
 *
 * The title is a real `h2`: a page's sections are landmarks a screen reader lists.
 */
export function Section({ title, count, action, children, className }: SectionProps) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-8', className)}>
      <SectionHeader as="h2" title={title} count={count} action={action} />
      {children}
    </section>
  );
}
