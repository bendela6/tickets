import { useColumnResize, type RenderThCtx, type RenderThResize } from '@tickets/table';
import { cn } from '../style';
import { Icon } from '../components/icon';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
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

export function renderTh<T>({ column, sort, totalSorts, onSortClick, resize }: RenderThCtx<T>) {
  return (
    <div
      role="columnheader"
      aria-sort={column.sortable ? ariaSort(sort?.direction) : undefined}
      className={cn(
        'relative px-3 py-2',
        'font-sans text-11/13 font-500 tracking-wider text-gray-11 uppercase',
        alignClass(column.align),
      )}
    >
      {column.sortable ? (
        <button
          type="button"
          onClick={onSortClick}
          className="flex w-full items-center gap-1 hover:text-gray-12"
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
