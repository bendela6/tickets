import type { RenderErrorCtx } from '@bh/table';
import { Button } from '../../primitives/components/button';
import { StateStrip } from './state-strip';

/**
 * A failed load, drawn as the table's body rather than in place of the table.
 *
 * The engine hands this slot the same position the rows would have had, so the
 * column header, the frame and the scroll container all stay — see A8, and the
 * engine's comment where it chooses this slot. Losing them was the old
 * behaviour and it was wrong twice over: the table stopped looking like a
 * table, and the columns the user was reading vanished along with the rows.
 *
 * `announce` rather than a `role="alert"` wrapper of its own: the alert has to
 * sit INSIDE the strip's gridcell, because a grid may not own an element with
 * an arbitrary role — see `StateStrip`. A failure still has to reach a screen
 * reader without the user going looking for it.
 *
 * The message goes on the mono detail line verbatim. It is the one piece of
 * this state that is data, and an error a caller has already phrased for a
 * person ("maison-fr · HTTP 502 · retrying in 30s") is more use than anything
 * this adapter could write in its place.
 */
export function renderError({ error, onRetry }: RenderErrorCtx) {
  return (
    <StateStrip
      announce
      title="Couldn't load rows"
      detail={error.message}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry now
          </Button>
        ) : null
      }
    />
  );
}
