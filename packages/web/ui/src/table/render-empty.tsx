import type { RenderEmptyCtx } from '@tickets/table';
import { ScreenState } from '../components/screen-state';

/**
 * Zero rows, not loading, no error.
 *
 * Reuses ScreenState so an empty table looks like every other empty surface in
 * the app rather than inventing a second treatment — the same reasoning as
 * `renderError`.
 *
 * The copy is deliberately generic. A caller that knows more ("filters are
 * hiding all 218 items across 4 projects") should override this slot rather
 * than push its vocabulary into the shared adapter; that is what the slots are
 * for. `filtered` only picks between the two shapes of nothing, since an empty
 * result and an over-filtered one call for different actions.
 */
export function renderEmpty({ filtered }: RenderEmptyCtx) {
  return (
    <ScreenState
      className="py-16"
      tone="neutral"
      icon="search"
      title={filtered ? 'No matches' : 'Nothing here yet'}
      body={
        filtered
          ? 'Every row is hidden by the current filters.'
          : 'There is nothing to show in this table.'
      }
    />
  );
}
