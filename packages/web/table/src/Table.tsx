import { Fragment, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toggleSort, multiSortToggle } from './sort-utils';
import { flattenGroups } from './flatten-groups';
import { useCellFocus } from './use-cell-focus';
import {
  GROUP_ROW_HEIGHT,
  ROW_HEIGHT,
  type CellFocusProps,
  type CellRef,
  type Column,
  type SortBy,
  type TableGroup,
  type TableRender,
  type TableState,
  type VirtualRow,
} from './types';

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Grouped rows. Mutually exclusive with `rows` in practice — when present it
   *  wins, and `rows` is ignored. */
  groups?: TableGroup<T>[];
  state: TableState;
  onSortChange: (next: SortBy[]) => void;
  onWidthChange: (key: string, px: number) => void;
  /** Accepted so `{...useTable()}` spreads cleanly. Nothing acts on it yet —
   *  collapsible groups are a later phase — but a caller keeping the state
   *  should not have to strip the handler back out. */
  onCollapseChange?: (next: Set<string>) => void;
  /** Supplying this is what turns the cell focus model ON: a roving tabindex
   *  over the cells, arrow-key navigation, and the grid as a single tab stop.
   *  Without it the engine does not touch the tab order, so a table whose
   *  cells hold links and buttons keeps them tabbable. */
  onFocusChange?: (next: CellRef | null) => void;
  onRowClick?: (row: T) => void;
  /** `Enter` on a focused cell that holds no widget of its own. */
  onRowActivate?: (row: T) => void;
  isLoading: boolean;
  error?: Error | null;
  render: TableRender<T>;
  /** Height of a data row in pixels. The virtualizer needs it up front, so a
   *  caller with a density toggle must pass the height for the current mode
   *  rather than styling rows and hoping. Defaults to ROW_HEIGHT. */
  rowHeight?: number;
  /** Row-level chrome that is not a column — see `RenderTrCtx.overlay`. */
  rowOverlay?: (row: T) => ReactNode;
  /** Whether a filter is responsible for there being no rows. Forwarded to the
   *  `empty` slot, which needs it to choose its copy. The engine cannot infer
   *  it: it receives rows, never the query that produced them. */
  isFiltered?: boolean;
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
    onFocusChange,
    onRowClick,
    onRowActivate,
    isLoading,
    error,
    rowHeight = ROW_HEIGHT,
    rowOverlay,
    isFiltered = false,
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

  // A data row's index is continuous across groups, but its position in the
  // virtualized list is not — group bands take slots too. Focus addresses the
  // former and the virtualizer wants the latter, so keep the map.
  const itemIndexOfRow: number[] = [];
  for (const [i, item] of items.entries()) {
    if (item.kind === 'row') {
      itemIndexOfRow[item.index] = i;
    }
  }

  const focus = useCellFocus({
    scrollEl,
    enabled: Boolean(onFocusChange),
    focused: state.focused,
    onFocusChange,
    geometry: {
      columnKeys: columns.map((c) => c.key),
      rowCount: itemIndexOfRow.length,
      // `scrollRect` comes from the virtualizer's own ResizeObserver, which
      // reports a real height where `clientHeight` reads 0 (jsdom, and the
      // frame before the first layout). One row is the floor: a PageDown that
      // moves nowhere is worse than one that moves a little.
      pageSize: Math.max(
        1,
        Math.floor((virtualizer.scrollRect?.height ?? scrollEl?.clientHeight ?? 0) / rowHeight),
      ),
    },
    scrollRowIntoView: (rowIndex) => {
      if (rowIndex < 0) {
        // The header row is sticky, but the table still scrolls to the top so
        // the user sees where focus went. A property assignment rather than
        // `scrollTo`, which jsdom does not implement.
        if (scrollEl) {
          scrollEl.scrollTop = 0;
        }
        return;
      }
      const itemIndex = itemIndexOfRow[rowIndex];
      if (itemIndex !== undefined) {
        virtualizer.scrollToIndex(itemIndex, { align: 'auto' });
      }
    },
    onActivate: (rowIndex) => {
      const item = items[itemIndexOfRow[rowIndex] ?? -1];
      if (item?.kind === 'row') {
        onRowActivate?.(item.row);
      }
    },
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
    children: columns.map((col, colIndex) => {
      const sortIdx = state.sort.findIndex((s) => s.field === col.key);
      const sort = sortIdx >= 0 ? state.sort[sortIdx] : undefined;
      const colWidth = startWidthOf(col, state.widths);
      return (
        <RenderTh
          key={col.key}
          column={col}
          index={colIndex}
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
          focused={focus.isFocused(HEADER_ROW, col.key)}
          focusProps={focus.focusPropsFor(HEADER_ROW, col.key)}
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
          rowHeight={rowHeight}
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

        const cells = columns.map((col, colIndex) => (
          <Fragment key={col.key}>
            {render.td({
              column: col,
              index: colIndex,
              row: item.row,
              children: renderCellContent(col, item.row),
              focused: focus.isFocused(item.index, col.key),
              focusProps: focus.focusPropsFor(item.index, col.key),
            })}
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
            overlay={rowOverlay ? rowOverlay(item.row) : undefined}
            slot={render.tr}
          />
        );
      }),
    });
  } else {
    // Not loading, no error, nothing to show. Rendered INSIDE root so the empty
    // state sits under the column header and within the scroll container,
    // rather than beside the table where a caller would otherwise have to put
    // it — losing the header above it.
    bodyNode = render.empty({ filtered: isFiltered });
  }

  return (
    <div
      ref={setScrollEl}
      data-slot="table-scroll"
      className="h-full w-full overflow-auto"
      style={{ overflowAnchor: 'none' }}
      // -1, never 0: this is not a tab stop, it is where DOM focus is PARKED
      // when the focused row is scrolled out and unmounted. Without it focus
      // would fall to <body> and the user would lose their place entirely.
      tabIndex={onFocusChange ? -1 : undefined}
      onKeyDown={focus.onKeyDown}
      onFocusCapture={focus.onFocusCapture}
      onBlurCapture={focus.onBlurCapture}
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

/** `CellRef.rowIndex` for the header row. */
const HEADER_ROW = -1;

function RenderTh<T>(props: {
  column: Column<T>;
  index: number;
  sort?: { direction: 'asc' | 'desc'; index: number };
  totalSorts: number;
  onSortClick: (e: MouseEvent) => void;
  resize?: { startWidth: number; minWidth?: number; onWidthChange: (px: number) => void };
  focused: boolean;
  focusProps: CellFocusProps;
  slot: TableRender<T>['th'];
}): ReactNode {
  return props.slot({
    column: props.column,
    index: props.index,
    sort: props.sort,
    totalSorts: props.totalSorts,
    onSortClick: props.onSortClick,
    resize: props.resize,
    focused: props.focused,
    focusProps: props.focusProps,
  });
}

function RenderTr<T>(props: {
  row: T;
  index: number;
  cells: ReactNode;
  gridTemplate: string;
  style: CSSProperties;
  onClick?: () => void;
  overlay?: ReactNode;
  slot: TableRender<T>['tr'];
}): ReactNode {
  return props.slot({
    row: props.row,
    index: props.index,
    cells: props.cells,
    gridTemplate: props.gridTemplate,
    style: props.style,
    onClick: props.onClick,
    overlay: props.overlay,
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
  rowHeight: number;
  slot: TableRender<T>['skeletonRow'];
}): ReactNode {
  return props.slot({
    columns: props.columns,
    gridTemplate: props.gridTemplate,
    rowHeight: props.rowHeight,
  });
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

/** Pixel start for the resize handle. A dragged width wins; then a numeric
 *  authored width; then a leading `<n>px` parsed out of a string width (so a
 *  `'96px'` column starts at 96, not the fallback); then 160. A track function
 *  like `minmax(240px, 1fr)` has no single pixel start, so it takes the
 *  fallback — which is why `startWidth` is a starting point, not a source of
 *  truth. */
function startWidthOf<T>(col: Column<T>, widths: Record<string, number>): number {
  const dragged = widths[col.key];
  if (dragged !== undefined) return dragged;
  if (typeof col.width === 'number') return col.width;
  if (typeof col.width === 'string') {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(col.width.trim());
    if (px) return Number(px[1]);
  }
  return 160;
}
