import type { ReactNode } from 'react';
import { cn } from './cn';

// The action row at the bottom of a dialog: a top hairline separator,
// actions right-aligned, Cancel (if any) first. This package can't import
// the app's Button (apps/web/src/ui/button.tsx) — so the caller supplies its
// own `<Button variant="ghost" onClick={close}>Cancel</Button>` as `cancel`
// rather than this component owning that button. Retires ~10 near-identical
// footer divs; className is a full escape hatch (twMerge-resolved) for
// dialogs whose footer needs extra leading content (a select, a hint) ahead
// of the action cluster — those nest DialogFooter with `border-t-0 p-0` and
// keep their own outer bar.
export function DialogFooter({
  children,
  cancel,
  className,
}: {
  children?: ReactNode;
  cancel?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mt-4 flex items-center justify-end gap-2 border-t border-hairline pt-4', className)}>
      {cancel}
      {children}
    </div>
  );
}
