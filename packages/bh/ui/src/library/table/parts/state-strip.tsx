import type { ReactNode } from 'react';
import { cn } from '../../../style';
import { BAND_STICKY_TOP } from './metrics';

/**
 * The one layout the error, empty and filtered-empty states share.
 *
 * Per the spec's A8: a 13/19 weight-500 title, a mono 12/17 detail line, and
 * at most one action. Three states with one shape rather than three, because
 * they are the same sentence with different words in it — "there are no rows,
 * here is why, here is the one thing to do about it".
 *
 * It is a STRIP, not a centred screen: `surface-raised` with the rows' own
 * `gray-6` rule beneath it, so it reads as the body of the table rather than a
 * panel that replaced the table. That is the whole point of A8 — the column
 * header stays put in every one of these states, and what sits under it has to
 * look like it belongs to the same object.
 *
 * The mono detail line is not decoration either. What goes there is data — an
 * error message, a count of hidden rows, a host and a status code — and mono
 * is this table's voice for data, the same as in the cells.
 *
 * `min-h-168` is four comfortable rows: the floor for a table so short that
 * centring has nothing to centre in, and the height the spec draws these
 * states at.
 */
export function StateStrip({
  title,
  detail,
  action,
  announce,
  className,
}: {
  title: string;
  detail: ReactNode;
  action?: ReactNode;
  /** Wraps the copy in `role="alert"`, so a failure arriving in a table the
   *  user is already looking at is spoken rather than waited for. */
  announce?: boolean;
  className?: string;
}) {
  // A `row` holding one `gridcell`, not a bare div. The strip lives INSIDE
  // `role="grid"` now, and a grid may only own rows and rowgroups — a div with
  // any role of its own (the `alert` this used to carry directly) is an
  // illegal child and axe reports it CRITICAL. Wrapped, the grid sees a row,
  // the row sees a cell, and the cell may hold whatever it likes, including
  // the alert. It is also simply true: "there are no rows" is what this row
  // says.
  return (
    // Absolutely positioned, from just under the column header to the bottom
    // of the table. The frame fills the viewport now, so a strip sized to its
    // own content would leave the message stranded at the top of a tall empty
    // box; this way it is centred in whatever space the table actually
    // occupies, which is what the design draws. The clip box is `relative`,
    // so that is what it resolves against.
    <div role="row" className={cn('absolute right-0 bottom-0 left-0', BAND_STICKY_TOP)}>
      <div
        role="gridcell"
        className={cn(
          'bg-surface-raised flex h-full min-h-168 w-full flex-col items-center justify-center px-16 py-32 text-center',
          className,
        )}
      >
        <div role={announce ? 'alert' : undefined} className="flex flex-col items-center gap-4">
          <span className="text-13/19 text-gray-12 font-500">{title}</span>
          <span className="text-12/17 text-gray-11 font-mono">{detail}</span>
          {/* `mt-8` on the action rather than a larger `gap`: the title and
              detail are one block and the action is a step away from it,
              which a single gap cannot say. */}
          {action ? <div className="mt-8">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
