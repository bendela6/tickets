import type { ReactNode } from 'react';
import { cn } from '../../../../style/cn';

/**
 * The row of buttons at the bottom of a dialog.
 *
 * The action row at the bottom of a dialog: a top hairline separator,
 * actions right-aligned, Cancel (if any) first. The caller supplies its own
 * `<Button variant="ghost" onClick={close}>Cancel</Button>` as `cancel`
 * rather than this component owning that button, since only the caller knows
 * how its dialog closes. Retires ~10 near-identical
 * footer divs; className is a full escape hatch (twMerge-resolved) for
 * dialogs whose footer needs extra leading content (a select, a hint) ahead
 * of the action cluster — those nest DialogFooter with `border-t-0 p-0` and
 * keep their own outer bar.
 */
export function DialogFooter({
  children,
  cancel,
  className,
}: {
  /** The buttons after `cancel`: the dialog's action. */
  children?: ReactNode;
  /** The cancel button, placed first. It is yours, since only your dialog knows how it closes. */
  cancel?: ReactNode;
  /** Classes merged onto the row; where they clash with its own, they win. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-gray-6 mt-16 flex items-center justify-end gap-8 border-t-1 pt-16',
        className,
      )}
    >
      {cancel}
      {children}
    </div>
  );
}
