import { Fragment, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toggleSort, multiSortToggle } from './sort-utils';
import { flattenGroups } from './flatten-groups';
import {
  GROUP_ROW_HEIGHT,
  ROW_HEIGHT,
  type Column,
  type SortBy,
  type TableGroup,
  type TableRender,
  type VirtualRow,
} from './types';

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Grouped rows. Mutually exclusive with `rows` in practice — when present it
   *  wins, and `rows` is ignored. */
  groups?: TableGroup<T>[];
  state: { sort: SortBy[]; widths: Record<string, number> };
  onSortChange: (next: SortBy[]) => void;
  onWidthChange: (key: string, px: number) => void;
  onRowClick?: (row: T) => void;
  isLoading: boolean;
  error?: Error | null;
  render: TableRender<T>;
  /** Height of a data row in pixels. The virtualizer needs it up front, so a
   *  caller with a density toggle must pass the height for the current mode
   *  rather than styling rows and hoping. Defaults to ROW_HEIGHT. */
  rowHeight?: number;
}

export function Table<T>(props: TableProps<T>): ReactNode {
  const {
    columns,
    rows,
    groups,
    state,
    render,
    onSortChange,
    onWidthChange,
    onRowClick,
    isLoading,
    error,
    rowHeight = ROW_HEIGHT,
  } = props;

  // An ungrouped table is one implicit group's worth of rows, so both shapes
  // go through the same virtualized list and the body loop below has one form.
  const items: VirtualRow<T>[] = groups
    ? flattenGroups(groups)
    : rows.map((row, index) => ({ kind: 'row' as const, row, index }));

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => (items[i]?.kind === 'group' ? GROUP_ROW_HEIGHT : rowHeight),
    overscan: 8,
  });

  if (error) {
    return render.error({ error });
  }

  const gridTemplate = columns.map((c) => trackSize(c, state.widths)).join(' ');

  const onHeaderClick = (col: Column<T>, e: MouseEvent) => {
    if (!col.sortable) {
      return;
    }
    onSortChange(
      e.shiftKey
        ? multiSortToggle(state.sort, col.key)
        : toggleSort(filterToCurrentField(state.sort, col.key), col.key),
    );
  };

  const headerNode = render.thead({
    gridTemplate,
    children: columns.map((col) => {
      const sortIdx = state.sort.findIndex((s) => s.field === col.key);
      const sort = sortIdx >= 0 ? state.sort[sortIdx] : undefined;
      const colWidth =
        state.widths[col.key] ?? (typeof col.width === 'number' ? col.width : 160);
      return (
        <RenderTh
          key={col.key}
          column={col}
          sort={sort ? { direction: sort.direction, index: sortIdx } : undefined}
          totalSorts={state.sort.length}
          onSortClick={(e) => onHeaderClick(col, e)}
          resize={
            (col.resizable ?? true)
              ? {
                  startWidth: colWidth,
                  minWidth: col.minWidth,
                  onWidthChange: (px) => onWidthChange(col.key, px),
                }
              : undefined
          }
          slot={render.th}
        />
      );
    }),
  });

  let bodyNode: ReactNode = null;
  if (isLoading && items.length === 0) {
    bodyNode = Array.from({ length: 10 }).map((_, i) => {
      return (
        <RenderSkeletonRow
          key={i}
          columns={columns}
          gridTemplate={gridTemplate}
          slot={render.skeletonRow}
        />
      );
    });
  } else if (items.length > 0) {
    bodyNode = render.tbody({
      totalSize: virtualizer.getTotalSize(),
      children: virtualizer.getVirtualItems().map((vi) => {
        const item = items[vi.index];
        if (!item) return null;

        const style: CSSProperties = {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: item.kind === 'group' ? GROUP_ROW_HEIGHT : rowHeight,
          transform: `translateY(${vi.start}px)`,
        };

        if (item.kind === 'group') {
          return (
            <RenderGroupHeader
              key={vi.key}
              groupKey={item.key}
              header={item.header}
              gridTemplate={gridTemplate}
              style={style}
              slot={render.groupHeader}
            />
          );
        }

        const cells = columns.map((col) => (
          <Fragment key={col.key}>
            {render.td({ column: col, row: item.row, children: renderCellContent(col, item.row) })}
          </Fragment>
        ));
        return (
          <RenderTr
            key={vi.key}
            row={item.row}
            index={item.index}
            cells={cells}
            gridTemplate={gridTemplate}
            style={style}
            onClick={onRowClick ? () => onRowClick(item.row) : undefined}
            slot={render.tr}
          />
        );
      }),
    });
  }

  return (
    <div
      ref={setScrollEl}
      data-slot="table-scroll"
      className="h-full w-full overflow-auto"
      style={{ overflowAnchor: 'none' }}
    >
      {render.root({
        children: (
          <>
            {headerNode}
            {bodyNode}
          </>
        ),
      })}
    </div>
  );
}

function RenderTh<T>(props: {
  column: Column<T>;
  sort?: { direction: 'asc' | 'desc'; index: number };
  totalSorts: number;
  onSortClick: (e: MouseEvent) => void;
  resize?: { startWidth: number; minWidth?: number; onWidthChange: (px: number) => void };
  slot: TableRender<T>['th'];
}): ReactNode {
  return props.slot({
    column: props.column,
    sort: props.sort,
    totalSorts: props.totalSorts,
    onSortClick: props.onSortClick,
    resize: props.resize,
  });
}

function RenderTr<T>(props: {
  row: T;
  index: number;
  cells: ReactNode;
  gridTemplate: string;
  style: CSSProperties;
  onClick?: () => void;
  slot: TableRender<T>['tr'];
}): ReactNode {
  return props.slot({
    row: props.row,
    index: props.index,
    cells: props.cells,
    gridTemplate: props.gridTemplate,
    style: props.style,
    onClick: props.onClick,
  });
}

function RenderGroupHeader(props: {
  groupKey: string;
  header: ReactNode;
  gridTemplate: string;
  style: CSSProperties;
  slot: TableRender<never>['groupHeader'];
}): ReactNode {
  return props.slot({
    key: props.groupKey,
    header: props.header,
    gridTemplate: props.gridTemplate,
    style: props.style,
  });
}

function RenderSkeletonRow<T>(props: {
  columns: Column<T>[];
  gridTemplate: string;
  slot: TableRender<T>['skeletonRow'];
}): ReactNode {
  return props.slot({ columns: props.columns, gridTemplate: props.gridTemplate });
}

function renderCellContent<T>(col: Column<T>, row: T): ReactNode {
  if (col.render) {
    return col.render(row);
  }
  if (col.as) {
    const value = col.value ? col.value(row) : undefined;
    return col.as({ value, row });
  }
  return col.value ? String(col.value(row) ?? '') : '';
}

function filterToCurrentField<F extends string>(sort: SortBy<F>[], key: F): SortBy<F>[] {
  return sort.filter((s) => s.field === key);
}

/** A dragged width always wins; then the authored width, numeric or track
 *  function; then a 160px fallback. */
function trackSize<T>(col: Column<T>, widths: Record<string, number>): string {
  const dragged = widths[col.key];
  if (dragged !== undefined) return `${dragged}px`;
  if (typeof col.width === 'string') return col.width;
  return `${col.width ?? 160}px`;
}
