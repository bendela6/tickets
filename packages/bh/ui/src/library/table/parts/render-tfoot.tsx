import type { RenderTfootCtx } from '@bh/table';
import { cn } from '../../../style';
import {
  cellDivider,
  cellGutter,
  COLUMN_TRACKS,
  PINNED_CELL,
  PINNED_EDGE,
  ROW_INSET,
  TOTALS_HEIGHT,
  trailingDivider,
} from './metrics';
import { pinStyle } from './render-td';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right'
    ? 'justify-end'
    : align === 'center'
      ? 'justify-center'
      : 'justify-start';
}

/**
 * The totals row, pinned above the table's dock.
 *
 * Plain `position: sticky` is enough here, unlike the group band: this row is
 * in normal flow after the body rather than absolutely positioned by the
 * virtualizer, so it sticks directly and needs no zero-height trick.
 *
 * `bottom` is a number rather than `bottom-0`, and it comes from the engine.
 * The page is what scrolls now, so this row sticks to the bottom of the
 * VIEWPORT — where the scrollbar and status bar are already docked. Sticking
 * at zero would park the totals underneath them.
 *
 * Its rule sits on the top edge rather than the bottom: this is the last thing
 * in the table, and a rule underneath would double up with the container's own
 * edge.
 *
 * Same `ROW_INSET`, `cellGutter` and alignment as a body row, because the whole
 * point of a total is that it lines up under the column it totals. Its height
 * is its own (`TOTALS_HEIGHT`) and no longer the header's: the two were equal
 * to bracket the table with matching bands, which stopped being true when the
 * header grew to 40px to carry its new surface.
 *
 * It freezes its columns exactly as a body row does, and for the same reason
 * lining the gutters up was never enough: this row is INSIDE the sheet, which
 * is slid sideways with a negative margin. Sticking to the bottom does nothing
 * about that axis, so until the engine published `pins` here the totals walked
 * out from under the columns they total — "412 items" leaving a frozen Name
 * column and painting across whatever had scrolled into its place.
 *
 * `z-10` on the row and `z-7` (via `PINNED_CELL`) on its frozen cells are not
 * in competition: `position: sticky` with a `z-index` opens a stacking
 * context, so the cells' rung is scoped to this row and only orders them
 * against their own siblings. The row as a whole still sits at `z-10` against
 * the table, above the frozen band the body rows scroll under — which is what
 * it has to be, because those rows scroll under THIS row too.
 */
export function renderTfoot<T>({ columns, bottomOffset, trailing, pins }: RenderTfootCtx<T>) {
  return (
    <div
      role="row"
      // `bg-gray-1` is doing a second job now: a frozen cell is `bg-inherit`,
      // so this is the colour it inherits. A transparent totals row would let
      // the columns slide visibly under its own frozen cells.
      className={cn(
        'border-t-gray-8 bg-gray-1 sticky z-10 grid w-full border-t-1',
        TOTALS_HEIGHT,
        ROW_INSET,
      )}
      style={{ ...COLUMN_TRACKS, bottom: bottomOffset }}
    >
      {columns.map((column, index) => {
        const pin = pins.get(column.key);
        return (
          <div
            key={column.key}
            role="gridcell"
            className={cn(
              'text-12/17 font-500 text-gray-12 flex min-w-0 items-center font-sans',
              cellGutter(index),
              cellDivider(index),
              trailingDivider(trailing && index === columns.length - 1),
              alignClass(column.align),
              pin && PINNED_CELL,
              // The frozen band's edge carries on through this row, which is
              // the last 36px of the table's height — without it the edge
              // stops just short of the bottom. Last, so `cn` can evict the
              // divider it replaces on a right-pinned column.
              pin?.edge && PINNED_EDGE[pin.side],
            )}
            style={pinStyle(pin)}
          >
            {column.footer}
          </div>
        );
      })}
    </div>
  );
}
