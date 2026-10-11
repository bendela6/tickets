import type { ReactNode } from 'react';
import { cn } from '../../../../style/cn';

// A section's baseline label row: the uppercase caption (item-detail's old
// SECTION_LABEL, detail-fields/detail-children/detail-links's headers, the
// settings tabs' sub-captions, and the two identical inline `Label` helpers
// in new-session-dialog/agent-editor). `count` renders as a direct sibling
// of the title in the flex row — so a caller combining pieces with their own
// gap (a Progress + mono text, an inline hint) gets them spaced by the SAME row
// gap as the title, matching every existing call site's layout exactly.
// `action` renders after a flex-1 spacer, pinned to the far right. Content
// that must sit flush against the title text (e.g. a required-field
// asterisk) belongs inside `title` itself instead of `count`.
//
// The row itself carries `text-11/13 tracking-wider` (11px/1.2/.06em) so `count` — which
// sets no font-size of its own (e.g. the `Label` helpers' hint span) —
// inherits the same 11px caption size the title renders at, instead of
// falling back to the document default. Callers that need their own size on
// `count` (a Progress's mono readout) already set it explicitly and win the
// cascade normally. The title keeps its own `text-11/13 tracking-wider` too so
// `title carries the uppercase mono-label styling` stays true in isolation.
/** A section's caption row: an uppercase title, an optional count, and an action on the right. */
export function SectionHeader({
  title,
  count,
  action,
  className,
  titleClassName,
  as = 'div',
}: {
  /**
   * The section's name, shown in uppercase.
   *
   * Something that must sit flush against it, like a required mark, goes in
   * here rather than in `count`.
   */
  title: ReactNode;
  /** Beside the title, a gap away, in the caption's size unless it sets its own. */
  count?: ReactNode;
  /** Pinned to the right end of the row. */
  action?: ReactNode;
  /** Added to the row's classes. It doesn't reach the title: use `titleClassName` for that. */
  className?: string;
  /**
   * Added to the title's classes, where it wins over the defaults.
   *
   * Merged onto the title element via `cn` (not the outer row) — `className`
   * lands on the row and can't reach the title's own text-size/color/tracking
   * classes, which silently defeats attempts to restyle the title. Use this
   * instead.
   */
  titleClassName?: string;
  /**
   * The title's element: a `div`, or `h2` or `h3` for a real heading.
   *
   * Element the title renders as. Defaults to a plain `div` (block-level, so
   * layout inside the flex row is unaffected either way); pass `h2`/`h3` when
   * the section needs a real heading in the accessibility tree.
   */
  as?: 'div' | 'h2' | 'h3';
}) {
  const Title = as;
  return (
    <div className={cn('text-11/13 flex items-center gap-8 tracking-wider', className)}>
      <Title
        className={cn(
          'text-11/13 font-500 text-gray-11 font-sans tracking-wider uppercase',
          titleClassName,
        )}
      >
        {title}
      </Title>
      {count}
      {action != null ? (
        <>
          <span className="flex-1" />
          {action}
        </>
      ) : null}
    </div>
  );
}
