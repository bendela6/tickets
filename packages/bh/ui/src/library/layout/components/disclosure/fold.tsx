import { useState, type ReactNode } from 'react';
import { cn, focusRing } from '../../../../style';
import { Icon, type IconSize } from '../../../primitives/components/icon';

// What Disclosure and FoldCard share: the open state, and the row that folds
// what follows it. Not exported from the package: an app reaches for one of
// the two, which each draw the row their own way.

/**
 * A fold's open state: the caller's while it passes `open`, its own from
 * `defaultOpen` otherwise, as Dropdown holds its own. `onOpenChange` hears
 * every change either way.
 */
export function useFoldOpen(
  open: boolean | undefined,
  defaultOpen: boolean,
  onOpenChange: ((open: boolean) => void) | undefined,
): [boolean, () => void] {
  const [own, setOwn] = useState(defaultOpen);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : own;
  function toggle() {
    // A controlled caller owns the value; writing the copy here too would
    // leave the two to drift the moment the caller declines a change.
    if (!controlled) {
      setOwn(!isOpen);
    }
    onOpenChange?.(!isOpen);
  }
  return [isOpen, toggle];
}

interface FoldRowProps {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  summary?: ReactNode;
  /** The id of what the row folds, drawn only while open. */
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
  open,
  onToggle,
  title,
  summary,
  contentId,
  rule,
  chevron,
  className,
  titleClassName,
  summaryClassName,
}: FoldRowProps) {
  const titleId = `${contentId}title`;
  const summaryId = `${contentId}summary`;
  const summarised = !open && summary != null && summary !== false && summary !== '';
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      aria-labelledby={titleId}
      aria-describedby={summarised ? summaryId : undefined}
      onClick={onToggle}
      className={cn(
        'flex min-w-0 items-center text-left',
        // Inward: a fold sits in a list of others or at a card's edge, where a
        // halo would be clipped or spill over the next row.
        focusRing('indigo', 'focus-visible', 'inward'),
        className,
      )}
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
