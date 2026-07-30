import type { RenderTdCtx } from '@tickets/table';
import { cn } from '../style';
import { CELL_FOCUS_RING, cellGutter } from './metrics';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right'
    ? 'justify-end'
    : align === 'center'
      ? 'justify-center'
      : 'justify-start';
}

export function renderTd<T>({ column, index, children, focused, focusProps }: RenderTdCtx<T>) {
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
      )}
      role="cell"
    >
      {children}
    </div>
  );
}
