import type { ReactNode } from 'react';
import type { RenderEmptyCtx } from '@bh/table';
import { Button } from '../../primitives/components/button';
import { StateStrip } from './state-strip';

/**
 * What a caller wants said when its table has nothing in it yet.
 *
 * Only the un-filtered state takes copy. "Your filters match nothing" is the
 * same sentence for every table in the app; "No files yet · Upload one to
 * start" is not, and a page that knows that should not have to hand over a
 * whole render slot to say it.
 */
export interface EmptyCopy {
  /** The line that says the table is empty: `No files yet`. */
  title: string;
  /** A sentence under it, saying how the first row gets there. */
  detail?: ReactNode;
}

/**
 * Zero rows, not loading, no error.
 *
 * Drawn INSIDE the table, under the live column header — see `StateStrip`, and
 * the engine's own comment where it picks this slot. It used to be a
 * `ScreenState`, the app's generic "nothing here" panel; A8 asks these states
 * to be part of the table rather than a stand-in for one, and a centred panel
 * with its own icon and its own vertical rhythm cannot be that.
 *
 * The copy is deliberately generic. A caller that knows more ("filters are
 * hiding all 218 items across 4 projects") should override this slot rather
 * than push its vocabulary into the shared adapter; that is what the slots are
 * for. `filtered` only picks between the two shapes of nothing, since an empty
 * result and an over-filtered one call for different actions — and the
 * filtered one is the only shape this adapter can offer an action for, because
 * clearing a filter is the one remedy that does not depend on what the table
 * is a table OF.
 */
export function renderEmpty({ filtered, onClearFilters }: RenderEmptyCtx, copy?: EmptyCopy) {
  if (filtered) {
    return (
      <StateStrip
        title="No rows match"
        detail="Every row is hidden by the current filters."
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null
        }
      />
    );
  }
  return (
    <StateStrip
      title={copy?.title ?? 'Nothing here yet'}
      detail={copy?.detail ?? 'There is nothing to show in this table.'}
    />
  );
}
