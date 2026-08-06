import { useColumnResize, type RenderThCtx, type RenderThResize } from '@tickets/table';
import { cn } from '../../style';
import { Icon } from '../icon';
import { CELL_FOCUS_RING, cellGutter, PINNED_CELL, PINNED_EDGE } from './metrics';
import { pinStyle } from './render-td';

// The cell is a flex row in both branches — a sortable header holds a caret
// and an ordinal beside its label, and a plain one still has to centre its
// label against the fixed header height. Flex layout ignores `text-align` on
// its own children, so column alignment is expressed as `justify-content`.
function justifyClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right'
    ? 'justify-end'
    : align === 'center'
      ? 'justify-center'
      : 'justify-start';
}

/** Column headers carry aria-sort so a screen reader announces the sort state
 *  the caret shows visually. */
function ariaSort(direction: 'asc' | 'desc' | undefined) {
  if (direction === 'asc') return 'ascending' as const;
  if (direction === 'desc') return 'descending' as const;
  return 'none' as const;
}

function ResizeHandle({ resize }: { resize: RenderThResize }) {
  const handlers = useColumnResize({
    startWidth: resize.startWidth,
    minWidth: resize.minWidth,
    onChange: resize.onWidthChange,
  });
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      {...handlers}
      // Double-clicking a resize handle to fit the column to its contents is
      // the gesture every spreadsheet has trained people to expect, and it is
      // the fastest way out of a column that truncates everything.
      onDoubleClick={resize.onAutoFit}
      className="absolute top-0 right-0 h-full w-4 cursor-col-resize hover:bg-gray-8"
    />
  );
}

export function renderTh<T>({
  column,
  index,
  sort,
  totalSorts,
  onSortClick,
  resize,
  focused,
  focusProps,
  pin,
  children,
}: RenderThCtx<T>) {
  return (
    <div
      role="columnheader"
      aria-sort={column.sortable ? ariaSort(sort?.direction) : undefined}
      // Carries the roving tabindex and this cell's coordinates. `rowIndex`
      // is -1 for every header cell, which is what makes ArrowUp from row 0
      // land here and sorting reachable without a mouse.
      {...focusProps}
      className={cn(
        // No vertical padding: the header's height is fixed by the row, and
        // the cell stretches into it so the resize handle spans all 36px.
        'relative flex items-center',
        cellGutter(index),
        'font-sans text-11/13 font-500 tracking-wider uppercase',
        justifyClass(column.align),
        // The sorted column reads at full strength; the rest sit back a step
        // and only come forward on hover.
        sort ? 'text-gray-12' : 'text-gray-11',
        focused && CELL_FOCUS_RING,
        // The header row is already sticky vertically; this adds the
        // horizontal half, so a frozen column's header travels with it.
        pin && PINNED_CELL,
        pin?.edge && PINNED_EDGE[pin.side],
      )}
      style={pinStyle(pin)}
    >
      {/* The engine takes this cell over when it owns what goes in it — today
          that means the select-all checkbox above a `select` column, which
          neither sorts nor shows a label. */}
      {children ? (
        children
      ) : column.sortable ? (
        <button
          type="button"
          onClick={onSortClick}
          // `uppercase` is repeated here rather than inherited from the cell.
          // Chrome's UA stylesheet sets `text-transform: none` on form
          // controls, and Tailwind's preflight re-inherits `font`,
          // `letter-spacing` and `color` for buttons but NOT `text-transform` —
          // so without this a sortable header renders in sentence case while
          // its non-sortable neighbour is in caps. Measured in a browser, not
          // deduced: jsdom computes no styles, so no test here can see it.
          className="flex cursor-pointer items-center gap-4 uppercase hover:text-gray-12"
        >
          {column.header}
          {sort ? (
            <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size="2xs" />
          ) : null}
          {/* The ordinal only means something once more than one column sorts. */}
          {totalSorts > 1 && sort ? (
            <span className="font-mono text-11 text-gray-9">{sort.index + 1}</span>
          ) : null}
        </button>
      ) : (
        column.header
      )}
      {resize ? <ResizeHandle resize={resize} /> : null}
    </div>
  );
}
