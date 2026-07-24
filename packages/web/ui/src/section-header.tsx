import type { ReactNode } from 'react';
import { cn } from './cn';

// A section's baseline label row: the uppercase caption (item-detail's old
// SECTION_LABEL, detail-fields/detail-children/detail-links's headers, the
// settings tabs' sub-captions, and the two identical inline `Label` helpers
// in new-session-dialog/agent-editor). `count` renders as a direct sibling
// of the title in the flex row — so a caller combining pieces with their own
// gap (a Meter + mono text, an inline hint) gets them spaced by the SAME row
// gap as the title, matching every existing call site's layout exactly.
// `action` renders after a flex-1 spacer, pinned to the far right. Content
// that must sit flush against the title text (e.g. a required-field
// asterisk) belongs inside `title` itself instead of `count`.
export function SectionHeader({
  title,
  count,
  action,
  className,
}: {
  title: ReactNode;
  count?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-sans text-label font-medium uppercase text-ink-2">{title}</span>
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
