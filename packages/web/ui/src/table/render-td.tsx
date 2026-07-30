import type { CellPin, RenderTdCtx } from '@tickets/table';
import type { CSSProperties } from 'react';
import { cn } from '../style';
import { CELL_FOCUS_RING, cellGutter, PINNED_CELL, PINNED_EDGE } from './metrics';

/** The engine works out how far in a frozen column sits; this only turns that
 *  number into the one CSS property it belongs in. A pixel offset cannot be a
 *  Tailwind class — it depends on the current column widths. */
export function pinStyle(pin: CellPin | undefined): CSSProperties | undefined {
  if (!pin) {
    return undefined;
  }
  return pin.side === 'left' ? { left: pin.offset } : { right: pin.offset };
}

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right'
    ? 'justify-end'
    : align === 'center'
      ? 'justify-center'
      : 'justify-start';
}

export function renderTd<T>({ column, index, children, focused, focusProps, pin }: RenderTdCtx<T>) {
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
        'flex min-w-0 items-center',
        cellGutter(index),
        alignClass(column.align),
        // The engine decides WHICH cell is focused; the ring is drawn here
        // and only here.
        focused && CELL_FOCUS_RING,
        pin && PINNED_CELL,
        pin?.edge && PINNED_EDGE[pin.side],
      )}
      style={pinStyle(pin)}
      role="cell"
    >
      {children}
    </div>
  );
}
