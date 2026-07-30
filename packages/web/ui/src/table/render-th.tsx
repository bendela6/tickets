import { useColumnResize, type RenderThCtx, type RenderThResize } from '@tickets/table';
import { cn } from '../style';
import { Icon } from '../components/icon';
import { CELL_FOCUS_RING, cellGutter } from './metrics';

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
      className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-gray-8"
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
      )}
    >
      {column.sortable ? (
        <button
          type="button"
          onClick={onSortClick}
          className="flex cursor-pointer items-center gap-1 hover:text-gray-12"
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
