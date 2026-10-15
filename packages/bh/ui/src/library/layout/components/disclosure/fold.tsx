import type { ReactNode } from 'react';
import type { UseDisclosureResult } from '@bh/hooks';
import { cn, focusRing } from '../../../../style';
import { Icon, type IconSize } from '../../../primitives/components/icon';

// What Disclosure and FoldCard share: the row that folds what follows it,
// drawn over @bh/hooks' useDisclosure, which holds the open state for both.
// Not exported from the package: an app reaches for one of the two, which
// each draw the row their own way, or for useDisclosure itself.

interface FoldRowProps {
  /** The open state, and the props for the button. */
  fold: UseDisclosureResult;
  title: ReactNode;
  summary?: ReactNode;
  /** The id of what the row folds, drawn only while open: the region's, as `useDisclosure` was given it. */
  contentId: string;
  /** A rule from the summary to the row's end. */
  rule?: boolean;
  chevron: IconSize;
  /** The row's own look: its padding, gap, colour and hover. */
  className: string;
  titleClassName: string;
  summaryClassName: string;
}

/**
 * The button: a chevron, the title, and the summary while folded.
 *
 * Named by its title alone and described by its summary, so a screen reader
 * says what it is, whether it is open, then what it holds, rather than one
 * long name. `aria-controls` is set only while open, when the content it
 * names is there to point at.
 */
export function FoldRow({
  fold,
  title,
  summary,
  contentId,
  rule,
  chevron,
  className,
  titleClassName,
  summaryClassName,
}: FoldRowProps) {
  const open = fold.isOpen;
  const titleId = `${contentId}title`;
  const summaryId = `${contentId}summary`;
  const summarised = !open && summary != null && summary !== false && summary !== '';
  return (
    <button
      {...fold.getTriggerProps({
        'aria-labelledby': titleId,
        'aria-describedby': summarised ? summaryId : undefined,
        className: cn(
          'flex min-w-0 items-center text-left',
          // Inward: a fold sits in a list of others or at a card's edge, where a
          // halo would be clipped or spill over the next row.
          focusRing('indigo', 'focus-visible', 'inward'),
          className,
        ),
      })}
    >
      {/* Rotation rather than two glyphs: the chevron turning is what reads as
          the one control changing state. It only decorates, so it stops for a
          reader who asks for less motion. */}
      <span
        aria-hidden
        className={cn('inline-flex shrink-0 motion-safe:transition-transform', open && 'rotate-90')}
      >
        <Icon name="chevron-right" size={chevron} />
      </span>
      <span id={titleId} className={cn('min-w-0 truncate', titleClassName)}>
        {title}
      </span>
      {summarised ? (
        // In a narrow row the summary gives way and the title, which names
        // the row, keeps its words: the summary starts from nothing and grows
        // into the room the title leaves, up to its own width (`max-w-fit`),
        // so the title is cut only once it alone is wider than the row. Its
        // grow outweighs the rule's, so beside a rule it takes all but the
        // rule's 24 pixels before it is cut, and the rule has what is left.
        <span
          id={summaryId}
          className={cn('max-w-fit min-w-0 grow-100 basis-0 truncate', summaryClassName)}
        >
          {summary}
        </span>
      ) : null}
      {rule ? <span aria-hidden className="bg-gray-6 h-px min-w-24 flex-1" /> : null}
    </button>
  );
}
