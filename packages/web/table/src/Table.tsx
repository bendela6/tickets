import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toggleSort, multiSortToggle } from './sort-utils';
import { flattenGroups } from './flatten-groups';
import { useCellFocus } from './use-cell-focus';
import {
  extendSelection,
  rangeBetween,
  selectionOf,
  toggleAll,
  toggleSelection,
} from './selection';
import {
  GROUP_ROW_HEIGHT,
  ROW_HEIGHT,
  type CellFocusProps,
  type CellPin,
  type CellRef,
  type Column,
  type ScrollX,
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
  /** Supplying this is what turns group collapsing on: each band gets a
   *  disclosure control, and a collapsed group's rows leave the virtualized
   *  list entirely. Without it the bands render as plain headers. */
  onCollapseChange?: (next: Set<string>) => void;
  /** Supplying this is what turns the cell focus model ON: a roving tabindex
   *  over the cells, arrow-key navigation, and the grid as a single tab stop.
   *  Without it the engine does not touch the tab order, so a table whose
   *  cells hold links and buttons keeps them tabbable. */
  onFocusChange?: (next: CellRef | null) => void;
  /** Stable identity for a row. Required for selection, which is keyed on id
   *  rather than position — under sort, filter and windowed loading the row
   *  at index 4 is not the row it was a moment ago. Optional so that every
   *  table that does not select does not have to supply one. */
  getRowId?: (row: T) => string;
  /** Supplying this, together with `getRowId`, is what turns row selection on.
   *  `Space` toggles the focused row; the checkbox column and shift-click
   *  ranges do the rest. */
  onSelectionChange?: (next: Set<string>) => void;
  onRowClick?: (row: T) => void;
  /** `Enter` on a focused cell that holds no widget of its own. */
  onRowActivate?: (row: T) => void;
  isLoading: boolean;
  error?: Error | null;
  render: TableRender<T>;
  /** Height of a data row in pixels. The virtualizer needs it up front, so a
   *  caller with a density toggle must pass the height for the current mode
   *  rather than styling rows and hoping. Defaults to ROW_HEIGHT.
   *
   *  A function gives per-row heights — a wrapped two-line title next to
   *  one-liners. It is asked BEFORE the row is rendered, so it must answer
   *  from the DATA; the engine cannot measure a row that does not exist yet.
   *  `row` is undefined where the row is not loaded. */
  rowHeight?: number | ((row: T | undefined, index: number) => number);
  /** Row-level chrome that is not a column — see `RenderTrCtx.overlay`. */
  rowOverlay?: (row: T) => ReactNode;
  /** Whether a filter is responsible for there being no rows. Forwarded to the
   *  `empty` slot, which needs it to choose its copy. The engine cannot infer
   *  it: it receives rows, never the query that produced them. */
  isFiltered?: boolean;
  /** Pin the current group's band under the column header while its rows
   *  scroll past.
   *
   *  Opt-in, like focus, selection and collapsing — and for a sharper reason
   *  than those. It renders the band a SECOND time, which changes the DOM of
   *  every grouped table that already exists: a group's label suddenly appears
   *  twice. That is a change a caller should ask for. */
  stickyGroupHeader?: boolean;
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
    onCollapseChange,
    onFocusChange,
    getRowId,
    onSelectionChange,
    onRowClick,
    onRowActivate,
    isLoading,
    error,
    rowHeight = ROW_HEIGHT,
    rowOverlay,
    isFiltered = false,
    stickyGroupHeader = false,
  } = props;

  // An ungrouped table is one implicit group's worth of rows, so both shapes
  // go through the same virtualized list and the body loop below has one form.
  const collapsedKeys = state.collapsed;
  const items: VirtualRow<T>[] = groups
    ? flattenGroups(groups, collapsedKeys)
    : rows.map((row, index) => ({ kind: 'row' as const, row, index }));

  /** Collapsing needs somewhere to send the result, so like focus and
   *  selection it is on only when the caller supplies the handler. */
  const toggleGroup = onCollapseChange
    ? (key: string) => {
        const next = new Set(collapsedKeys ?? []);
        if (!next.delete(key)) {
          next.add(key);
        }
        onCollapseChange(next);
      }
    : undefined;

  // A data row's index is continuous across groups, but its position in the
  // virtualized list is not — group bands take slots too. Focus addresses the
  // former and the virtualizer wants the latter, so keep the map.
  const itemIndexOfRow: number[] = [];
  for (const [i, item] of items.entries()) {
    if (item.kind === 'row') {
      itemIndexOfRow[item.index] = i;
    }
  }

  /**
   * A row's height, which may differ per row — a wrapped title needs two
   * lines, a one-liner does not. The virtualizer asks for it BEFORE the row
   * exists, so this is a function of the data and never a measurement.
   */
  const heightOf = (index: number): number => {
    if (typeof rowHeight === 'number') {
      return rowHeight;
    }
    const item = items[itemIndexOfRow[index] ?? -1];
    return rowHeight(item?.kind === 'row' ? item.row : undefined, index);
  };
  /** One number, for the places that need a representative height rather than
   *  a specific row's: the skeleton and the PageUp/PageDown step. */
  const baseRowHeight = typeof rowHeight === 'number' ? rowHeight : ROW_HEIGHT;

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  /**
   * Which horizontal edges have content hidden past them.
   *
   * Kept as state rather than read during render because it is a MEASUREMENT:
   * `scrollWidth` and `clientWidth` are only true after layout, and a table
   * whose columns have just been resized has to re-measure without a scroll
   * event ever firing. Hence both an `onScroll` handler and a layout effect.
   */
  const [scrollX, setScrollX] = useState<ScrollX>('none');
  const syncScrollX = () => {
    const el = scrollEl;
    if (!el) {
      return;
    }
    const hidden = el.scrollWidth - el.clientWidth;
    // A one-pixel tolerance: sub-pixel column widths otherwise leave a table
    // that visibly fits reporting a fraction of a pixel of overflow forever.
    if (hidden <= 1) {
      setScrollX('none');
      return;
    }
    if (el.scrollLeft <= 1) {
      setScrollX('start');
    } else if (el.scrollLeft >= hidden - 1) {
      setScrollX('end');
    } else {
      setScrollX('middle');
    }
  };
  useLayoutEffect(syncScrollX);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => {
      const item = items[i];
      return item?.kind === 'group' ? GROUP_ROW_HEIGHT : heightOf(item?.index ?? i);
    },
    overscan: 8,
  });

  // Selection needs both halves: an id to key on and somewhere to send the
  // result. One without the other is a caller mistake, not a half-feature.
  const selectable = Boolean(getRowId && onSelectionChange);
  const selectedIds = state.selected ?? EMPTY_SELECTION;
  const rowIdAt = (rowIndex: number): string | null => {
    const item = items[itemIndexOfRow[rowIndex] ?? -1];
    return item?.kind === 'row' && getRowId ? getRowId(item.row) : null;
  };
  /**
   * Where a shift-click range starts. The last row selected WITHOUT shift,
   * seeded from wherever focus was.
   *
   * It cannot simply read `state.focused` at click time: focus moves to the
   * clicked cell before the click handler runs, so the anchor and the target
   * would always be the same row and every shift-click would select one row.
   */
  const anchorRow = useRef<number | null>(null);

  const selectRow = (rowIndex: number, shiftKey: boolean) => {
    if (!onSelectionChange) {
      return;
    }
    const anchor = anchorRow.current ?? state.focused?.rowIndex ?? rowIndex;
    if (shiftKey && anchor >= 0) {
      const ids = rangeBetween(anchor, rowIndex)
        .map(rowIdAt)
        .filter((id): id is string => id !== null);
      onSelectionChange(extendSelection(selectedIds, ids));
      return;
    }
    const id = rowIdAt(rowIndex);
    if (id === null) {
      return;
    }
    anchorRow.current = rowIndex;
    onSelectionChange(toggleSelection(selectedIds, id));
  };

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
      //
      // The BASE height, not a per-row one: a page is a rough distance, and
      // asking "how many rows fit" of a table whose rows differ in height has
      // no single answer worth computing on every keystroke.
      pageSize: Math.max(
        1,
        Math.floor((virtualizer.scrollRect?.height ?? scrollEl?.clientHeight ?? 0) / baseRowHeight),
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
    onSelect: selectable ? selectRow : undefined,
  });

  if (error) {
    return render.error({ error });
  }

  const gridTemplate = columns.map((c) => trackSize(c, state.widths)).join(' ');
  const pins = pinOffsets(columns, state.widths);
  const hasPinned = pins.size > 0;

  /**
   * Size a column to its widest MOUNTED cell.
   *
   * Measured rather than estimated: only the DOM knows how wide a given title
   * is in this font at this weight, and a character count guesses badly at
   * both ends. `scrollWidth` is the full content width even where the cell
   * clips it with `truncate`, which is exactly the number wanted.
   *
   * Only mounted rows are measured, and under virtualization that is the only
   * honest answer — measuring 800,000 rows would mean rendering them.
   */
  const autoFitColumn = (col: Column<T>) => {
    if (!scrollEl) {
      return;
    }
    let widest = 0;
    for (const cell of scrollEl.querySelectorAll<HTMLElement>('[data-cell-col]')) {
      if (cell.getAttribute('data-cell-col') === col.key) {
        widest = Math.max(widest, cell.scrollWidth);
      }
    }
    if (widest > 0) {
      onWidthChange(col.key, Math.max(widest, col.minWidth ?? 0));
    }
  };

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

  // Every row the table currently holds, in order. What "select all" means:
  // the rows on screen and off, but NOT rows a filter has removed — those are
  // not in `rows` at all, which is exactly the right answer.
  const allRowIds = getRowId
    ? items.flatMap((item) => (item.kind === 'row' ? [getRowId(item.row)] : []))
    : [];

  const selectAllCell = () => {
    if (!selectable || !render.selectCell || !onSelectionChange) {
      return undefined;
    }
    const { checked, indeterminate } = selectionOf(selectedIds, allRowIds);
    return render.selectCell({
      checked,
      indeterminate,
      isHeader: true,
      label: 'Select all rows',
      onChange: () => onSelectionChange(toggleAll(selectedIds, allRowIds)),
    });
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
                  onAutoFit: () => autoFitColumn(col),
                }
              : undefined
          }
          focused={focus.isFocused(HEADER_ROW, col.key)}
          focusProps={focus.focusPropsFor(HEADER_ROW, col.key)}
          pin={pins.get(col.key)}
          content={col.select ? selectAllCell() : undefined}
          slot={render.th}
        />
      );
    }),
  });

  /**
   * The band for whichever group the topmost visible row belongs to, pinned
   * under the column header so a long group still says what you are looking at.
   *
   * It has to be a SECOND rendering of the band rather than the real one made
   * sticky: the virtualizer positions every item absolutely, and
   * `position: sticky` does nothing on an absolutely positioned element. The
   * engine decides which group is active; where it sticks and what it looks
   * like belong to the render set, which is handed `sticky: true` and nothing
   * else.
   *
   * Walking backwards from the first visible item is a scan over `items`, not
   * over the virtual window — `items` is already fully materialized here, so
   * this costs one loop bounded by the number of rows above the viewport, and
   * stops at the first band it meets.
   */
  const stickyGroup = (() => {
    if (!stickyGroupHeader || !groups || items.length === 0) {
      return null;
    }
    const first = virtualizer.getVirtualItems()[0]?.index;
    if (first === undefined) {
      return null;
    }
    for (let i = first; i >= 0; i -= 1) {
      const item = items[i];
      if (item?.kind === 'group') {
        return item;
      }
    }
    return null;
  })();

  let bodyNode: ReactNode = null;
  let stickyGroupNode: ReactNode = null;
  if (isLoading && items.length === 0) {
    bodyNode = Array.from({ length: 10 }).map((_, i) => {
      return (
        <RenderSkeletonRow
          key={i}
          columns={columns}
          gridTemplate={gridTemplate}
          // A placeholder stands in for a row that has not arrived, so there
          // is no row to ask for a per-row height. The base height is the only
          // answer available and the right one.
          rowHeight={baseRowHeight}
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
          height: item.kind === 'group' ? GROUP_ROW_HEIGHT : heightOf(item.index),
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
              collapsed={Boolean(collapsedKeys?.has(item.key))}
              onToggle={toggleGroup ? () => toggleGroup(item.key) : undefined}
              slot={render.groupHeader}
            />
          );
        }

        const rowId = getRowId ? getRowId(item.row) : null;
        const rowIndex = item.index;
        const cells = columns.map((col, colIndex) => (
          <Fragment key={col.key}>
            {render.td({
              column: col,
              index: colIndex,
              row: item.row,
              children:
                col.select && selectable && render.selectCell
                  ? render.selectCell({
                      checked: rowId !== null && selectedIds.has(rowId),
                      isHeader: false,
                      label: `Select row ${rowIndex + 1}`,
                      onChange: (shiftKey) => selectRow(rowIndex, shiftKey),
                    })
                  : renderCellContent(col, item.row),
              focused: focus.isFocused(rowIndex, col.key),
              focusProps: focus.focusPropsFor(rowIndex, col.key),
              pin: pins.get(col.key),
            })}
          </Fragment>
        ));
        return (
          <RenderTr
            key={vi.key}
            row={item.row}
            index={rowIndex}
            cells={cells}
            gridTemplate={gridTemplate}
            style={style}
            onClick={onRowClick ? () => onRowClick(item.row) : undefined}
            overlay={rowOverlay ? rowOverlay(item.row) : undefined}
            selected={rowId !== null && selectedIds.has(rowId)}
            hasPinned={hasPinned}
            slot={render.tr}
          />
        );
      }),
    });
    stickyGroupNode = stickyGroup
      ? render.groupHeader({
          key: stickyGroup.key,
          header: stickyGroup.header,
          gridTemplate,
          // No virtualizer style: this copy is not in the virtual list. The
          // render set positions it.
          style: {},
          sticky: true,
          collapsed: Boolean(collapsedKeys?.has(stickyGroup.key)),
          onToggle: toggleGroup ? () => toggleGroup(stickyGroup.key) : undefined,
        })
      : null;
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
      // The scroll state is on the element as an attribute AND in the class
      // the render set chose: the attribute is what a test and a screenshot
      // can read, the class is what a person sees.
      data-scroll-x={scrollX}
      className={joinClasses('h-full w-full overflow-auto', render.scrollClass?.({ scrollX }))}
      style={{ overflowAnchor: 'none' }}
      // -1, never 0: this is not a tab stop, it is where DOM focus is PARKED
      // when the focused row is scrolled out and unmounted. Without it focus
      // would fall to <body> and the user would lose their place entirely.
      tabIndex={onFocusChange ? -1 : undefined}
      onScroll={syncScrollX}
      onKeyDown={focus.onKeyDown}
      onFocusCapture={focus.onFocusCapture}
      onBlurCapture={focus.onBlurCapture}
    >
      {render.root({
        children: (
          <>
            {headerNode}
            {stickyGroupNode}
            {bodyNode}
          </>
        ),
      })}
    </div>
  );
}

/** `CellRef.rowIndex` for the header row. */
const HEADER_ROW = -1;

/** The engine has no `cn`, and does not want one — this only ever joins its
 *  own two strings, one of which the render set supplied. */
function joinClasses(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Where each pinned column sticks.
 *
 * A left-pinned column sits past the widths of the left-pinned columns before
 * it; a right-pinned one past those after it. The widths come from the same
 * `startWidthOf` the resize handle uses, so a dragged width moves the pinned
 * offsets with it and the columns cannot overlap.
 *
 * The INNERMOST pinned column on each side is marked `edge` — it is the one
 * bordering the part that scrolls, and the only one that should carry a
 * divider. Marking them all would draw a line between every frozen column.
 */
function pinOffsets<T>(columns: Column<T>[], widths: Record<string, number>): Map<string, CellPin> {
  const pins = new Map<string, CellPin>();
  const left = columns.filter((c) => c.pinned === 'left');
  const right = columns.filter((c) => c.pinned === 'right');

  let offset = 0;
  for (const [i, col] of left.entries()) {
    pins.set(col.key, { side: 'left', offset, edge: i === left.length - 1 });
    offset += startWidthOf(col, widths);
  }
  offset = 0;
  for (const [i, col] of [...right].reverse().entries()) {
    pins.set(col.key, { side: 'right', offset, edge: i === right.length - 1 });
    offset += startWidthOf(col, widths);
  }
  return pins;
}

/** Shared empty set, so a table with no selection does not hand a fresh
 *  object to every row on every render. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

function RenderTh<T>(props: {
  column: Column<T>;
  index: number;
  sort?: { direction: 'asc' | 'desc'; index: number };
  totalSorts: number;
  onSortClick: (e: MouseEvent) => void;
  resize?: {
    startWidth: number;
    minWidth?: number;
    onWidthChange: (px: number) => void;
    onAutoFit: () => void;
  };
  focused: boolean;
  focusProps: CellFocusProps;
  pin?: CellPin;
  content?: ReactNode;
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
    pin: props.pin,
    children: props.content,
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
  selected?: boolean;
  hasPinned?: boolean;
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
    selected: props.selected,
    hasPinned: props.hasPinned,
  });
}

function RenderGroupHeader(props: {
  groupKey: string;
  header: ReactNode;
  gridTemplate: string;
  style: CSSProperties;
  collapsed: boolean;
  onToggle?: () => void;
  slot: TableRender<never>['groupHeader'];
}): ReactNode {
  return props.slot({
    key: props.groupKey,
    header: props.header,
    gridTemplate: props.gridTemplate,
    style: props.style,
    collapsed: props.collapsed,
    onToggle: props.onToggle,
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
