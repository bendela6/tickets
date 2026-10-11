import type { RenderFilterRowCtx } from '@bh/table';
import { cn } from '../../../style';
import {
  cellDivider,
  cellGutter,
  COLUMN_TRACKS,
  FILTER_ROW_HEIGHT,
  HEAD_SURFACE,
  PINNED_CELL,
  PINNED_EDGE,
  ROW_INSET,
  trailingDivider,
} from './metrics';
import { pinStyle } from './render-td';

/**
 * The filter row: one control per filtered column, directly under its label.
 *
 * On the header's own surface, because it IS the header's second half — a band
 * of inputs belonging to the labels above them, not a first row of data. The
 * header hands it into its sticky box, so the two stick as one.
 *
 * Every cell lines up exactly as the header cell above it does — the same
 * gutter, the same divider, the same freeze — or a column's filter drifts out
 * from under the column it filters.
 */
export function renderFilterRow<T>({ columns, trailing, pins }: RenderFilterRowCtx<T>) {
  return (
    <div
      role="row"
      // Row 2: the column header is row 1, and the engine counts this row
      // before numbering the data rows below it.
      aria-rowindex={2}
      data-slot="table-filter-row"
      className={cn('grid w-full border-b-1', HEAD_SURFACE, FILTER_ROW_HEIGHT, ROW_INSET)}
      style={COLUMN_TRACKS}
    >
      {columns.map((column, index) => {
        const pin = pins.get(column.key);
        return (
          <div
            key={column.key}
            role="gridcell"
            className={cn(
              'flex min-w-0 items-center',
              cellGutter(index),
              cellDivider(index),
              trailingDivider(trailing && index === columns.length - 1),
              pin && PINNED_CELL,
              pin?.edge && PINNED_EDGE[pin.side],
            )}
            style={pinStyle(pin)}
          >
            {column.filter}
          </div>
        );
      })}
    </div>
  );
}
