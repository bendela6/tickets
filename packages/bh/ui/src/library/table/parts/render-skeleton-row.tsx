import type { RenderSkeletonRowCtx } from '@bh/table';
import { cn } from '../../../style';
import {
  cellDivider,
  cellGutter,
  COLUMN_TRACKS,
  PINNED_CELL,
  PINNED_EDGE,
  ROW_INSET,
  SELECT_CELL,
  trailingDivider,
} from './metrics';
import { pinStyle } from './render-td';

export function renderSkeletonRow<T>({
  columns,
  rowHeight,
  trailing,
  pins,
}: RenderSkeletonRowCtx<T>) {
  return (
    <div
      data-skeleton-row
      // Same inset and gutters as a real row: a skeleton that sat on different
      // metrics would visibly shift its columns the moment the data arrived.
      // `bg-surface-raised` is also what a frozen cell's `bg-inherit` resolves
      // to here, for the same reason the real row needs a colour to offer.
      className={cn('border-gray-6 bg-surface-raised grid w-full border-b-1', ROW_INSET)}
      style={{ ...COLUMN_TRACKS, height: rowHeight }}
    >
      {columns.map((col, index) => {
        const pin = pins.get(col.key);
        return (
          <div
            key={col.key}
            className={cn(
              'flex items-center',
              cellGutter(index),
              cellDivider(index),
              trailingDivider(trailing && index === columns.length - 1),
              // Including the selection column's, which is 36px wide and takes
              // no gutter at all — the same metric the real cell above it uses.
              col.select && SELECT_CELL,
              // A skeleton freezes its columns like the rows it stands in for.
              // A table left scrolled sideways keeps its position across a
              // reload, so without this the placeholder shows the frozen
              // columns somewhere the real rows will not put them, and the
              // whole table jumps when the data lands.
              pin && PINNED_CELL,
              // And the band's edge, so it does not stop dead above a table
              // that is still loading. Composed last so `cn` can evict the
              // divider this replaces on a right-pinned column.
              pin?.edge && PINNED_EDGE[pin.side],
            )}
            style={pinStyle(pin)}
          >
            <div className="rounded-4 bg-gray-4 h-8 w-3/5 animate-pulse" />
          </div>
        );
      })}
    </div>
  );
}
