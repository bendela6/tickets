import type { CellPin, RenderTdCtx } from '@bh/table';
import type { CSSProperties } from 'react';
import { cn } from '../../../style';
import { Pill } from '../../primitives/components/pill';
import {
  CELL_COPY_RING,
  CELL_COPY_TAG,
  CELL_FOCUS_FILL,
  CELL_FOCUS_LIFT,
  CELL_FOCUS_RING,
  CELL_FOCUS_RING_STYLE,
  cellDivider,
  trailingDivider,
  cellGutter,
  PINNED_CELL,
  PINNED_EDGE,
  SELECT_CELL,
} from './metrics';

/**
 * Hold a frozen column still while the rest of the table slides under it.
 *
 * It used to be `left: <offset>` on a `position: sticky` cell, which is the
 * obvious way to do this and no longer possible: sticky needs a scrollport,
 * and the table deliberately has none — the page scrolls, and the columns are
 * slid sideways under a clip. So the cell is `position: relative` and moves by
 * exactly as much as the sheet moved, in the other direction, which leaves it
 * looking untouched.
 *
 * The engine does the arithmetic (`pin.shift`) because only the engine knows
 * how far the sheet has gone. This turns the number into the one CSS property
 * it belongs in — it cannot be a Tailwind class, since it changes on every
 * frame of a horizontal scroll.
 */
export function pinStyle(pin: CellPin | undefined): CSSProperties | undefined {
  if (!pin) {
    return undefined;
  }
  return { left: pin.shift };
}

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right'
    ? 'justify-end'
    : align === 'center'
      ? 'justify-center'
      : 'justify-start';
}

export function renderTd<T>({
  column,
  index,
  children,
  focused,
  focusProps,
  pin,
  trailing,
  copy,
}: RenderTdCtx<T>) {
  return (
    <div
      // `focusProps` carries the roving tabindex and the coordinates the
      // engine uses to find this cell again after virtualization has
      // unmounted and remounted it. Dropping it silently disables keyboard
      // navigation for the whole table.
      {...focusProps}
      // `flex min-w-0` rather than a plain block: it is what lets a cell's
      // content use `truncate`, which needs a shrinkable box to ellipsize
      // against.
      className={cn(
        // `relative` so the focus ring, which is an overlay rather than an
        // outline, resolves against this cell.
        'relative flex min-w-0 items-center',
        cellGutter(index),
        cellDivider(index),
        trailingDivider(trailing),
        alignClass(column.align),
        // A checkbox is not a column of text. Last of the three, because it
        // OVERRIDES the gutter and the alignment above rather than joining
        // them — see SELECT_CELL.
        column.select && SELECT_CELL,
        pin && PINNED_CELL,
        pin?.edge && PINNED_EDGE[pin.side],
        // A focused cell shares its layer with the frozen column beside it and
        // loses to it on DOM order, which is how the ring's right edge went
        // missing. Lifting is only ever right for a cell that is itself
        // frozen — see CELL_FOCUS_LIFT.
        focused && pin && CELL_FOCUS_LIFT,
      )}
      // The fill comes from the row (see CELL_FOCUS_FILL_VAR); the pin offset
      // from the engine. Only one of the two is ever set.
      style={focused ? { ...pinStyle(pin), ...CELL_FOCUS_FILL } : pinStyle(pin)}
      role="gridcell"
      // 1-based, and stated explicitly because a hidden or reordered column
      // would otherwise leave the DOM order disagreeing with the real one.
      aria-colindex={index + 1}
    >
      {children}
      {/* The engine decides WHICH cell is focused; the ring is drawn here and
          only here — a header cell deliberately does not draw it, see
          renderTh. After the children, so it paints over them.

          The style carries the one offset the cell cannot decide, which is how
          far up the ring may reach (CELL_FOCUS_TOP_VAR). `data-slot` because
          whether a ring exists, and on what, is the only part of this a test
          can see — jsdom applies no stylesheet. */}
      {focused ? (
        <span
          aria-hidden
          data-slot="cell-focus-ring"
          className={cn(CELL_FOCUS_RING, copy && CELL_COPY_RING[copy])}
          style={CELL_FOCUS_RING_STYLE}
        />
      ) : null}
      {/* For a moment after Ctrl+C, the cell says how its copy went, in words
          beside the ring's colour. A status, so a screen reader says it too. */}
      {copy ? (
        <Pill
          role="status"
          size="sm"
          tone={copy === 'copied' ? 'success' : 'danger'}
          icon={copy === 'copied' ? 'check' : 'x'}
          label={copy === 'copied' ? 'Copied' : 'Could not copy'}
          className={CELL_COPY_TAG}
        />
      ) : null}
    </div>
  );
}
