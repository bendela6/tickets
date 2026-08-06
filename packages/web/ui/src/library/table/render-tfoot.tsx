import type { RenderTfootCtx } from '@tickets/table';
import { cn } from '../../style';
import { cellGutter, HEAD_HEIGHT, ROW_INSET } from './metrics';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
}

/**
 * The totals row, pinned to the bottom of the scroll container.
 *
 * Plain `position: sticky` is enough here, unlike the group band: this row is
 * in normal flow after the body rather than absolutely positioned by the
 * virtualizer, so it sticks against the scroll container directly and needs no
 * zero-height trick.
 *
 * Its rule sits on the top edge rather than the bottom: this is the last thing
 * in the table, and a rule underneath would double up with the container's own
 * edge.
 *
 * Same `ROW_INSET`, `cellGutter` and alignment as a body row, because the whole
 * point of a total is that it lines up under the column it totals. It reuses
 * HEAD_HEIGHT so the table is bracketed by two bands of equal weight.
 */
export function renderTfoot<T>({ columns, gridTemplate }: RenderTfootCtx<T>) {
  return (
    <div
      role="row"
      className={cn(
        'sticky bottom-0 z-10 grid w-full min-w-max items-center border-t-1 border-gray-6 bg-gray-1',
        HEAD_HEIGHT,
        ROW_INSET,
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {columns.map((column, index) => (
        <div
          key={column.key}
          role="gridcell"
          className={cn(
            'flex min-w-0 items-center font-sans text-12/17 font-500 text-gray-12',
            cellGutter(index),
            alignClass(column.align),
          )}
        >
          {column.footer}
        </div>
      ))}
    </div>
  );
}
