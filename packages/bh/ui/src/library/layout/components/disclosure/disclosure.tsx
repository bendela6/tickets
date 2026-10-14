import { useId, type ReactNode } from 'react';
import { cn } from '../../../../style';
import type { IconSize } from '../../../primitives/components/icon';
import { FoldRow, useFoldOpen } from './fold';

/**
 * How loud the row is.
 *
 * `md` heads a section among others, as a form's: a 13px title over a hover
 * fill. `sm` is a quiet line that folds a detail away under what it belongs
 * to, as "what changed" under a version, in the gray of the text around it.
 */
export type DisclosureSize = 'sm' | 'md';

interface DisclosureProps {
  /** What it folds, named beside the chevron. */
  title: ReactNode;
  /**
   * Beside the title while folded: what is in it, cut to one line, and cut
   * first in a narrow row, so the title keeps its words. Gone once open.
   */
  summary?: ReactNode;
  /**
   * Whether it is open. Leave it out and the row holds its own, from
   * `defaultOpen`.
   */
  open?: boolean;
  /** Whether it starts open, when `open` is left out. */
  defaultOpen?: boolean;
  /** Called with the new state on every click, whether `open` is given or not. */
  onOpenChange?: (open: boolean) => void;
  /** `md`, a section's 13-pixel title over a hover fill; `sm`, a quiet 12-pixel line. */
  size?: DisclosureSize;
  /** Draws a rule from the title to the row's end, to set a section apart from the next. */
  rule?: boolean;
  /** Added to the outer element's classes. */
  className?: string;
  /** What it folds: under the row, in line with the title, drawn only while open. */
  children: ReactNode;
}

// The row bleeds out by its own padding, so its hover fill has room while the
// chevron stays in line with the text above and below it. The content is
// indented by the chevron and the gap, so it starts under the title.
const ROW: Record<DisclosureSize, string> = {
  md: 'rounded-6 hover:bg-gray-2 text-gray-11 -mx-8 gap-8 px-8 py-8',
  sm: 'rounded-4 text-12/17 text-gray-11 hover:text-gray-12 -mx-4 gap-6 px-4 py-2',
};
const TITLE: Record<DisclosureSize, string> = {
  md: 'text-13/19 font-500 text-gray-12',
  sm: '',
};
const SUMMARY: Record<DisclosureSize, string> = { md: 'text-12/17', sm: 'text-gray-10' };
const CHEVRON: Record<DisclosureSize, IconSize> = { md: 'lg', sm: 'md' };
// 16 + 8 and 14 + 6: the chevron and the gap after it.
const CONTENT: Record<DisclosureSize, string> = { md: 'pt-4 pb-12 pl-24', sm: 'pt-8 pl-20' };

/**
 * A row that folds what follows it: a chevron, a title, and a summary while
 * folded.
 *
 * The content is drawn only while open, so a fold of a long list or a log
 * costs nothing until it is opened; state inside it goes when it closes, so
 * keep that in the caller.
 */
export function Disclosure({
  title,
  summary,
  open,
  defaultOpen = false,
  onOpenChange,
  size = 'md',
  rule = false,
  className,
  children,
}: DisclosureProps) {
  const contentId = `${useId()}content`;
  const [isOpen, toggle] = useFoldOpen(open, defaultOpen, onOpenChange);
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <FoldRow
        open={isOpen}
        onToggle={toggle}
        title={title}
        summary={summary}
        contentId={contentId}
        rule={rule}
        chevron={CHEVRON[size]}
        // A quiet line is as wide as its words, so the click lands on them and
        // not on the empty width beside; a rule needs the width to run along.
        className={cn(ROW[size], size === 'sm' && !rule && 'self-start')}
        titleClassName={TITLE[size]}
        summaryClassName={SUMMARY[size]}
      />
      {isOpen ? (
        <div id={contentId} className={CONTENT[size]}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
