import {
  Fragment,
  useEffect,
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
import { useScrollHost } from './use-scroll-host';
import { useHbarDrag } from './use-hbar-drag';
import { useMiddlePan } from './use-middle-pan';
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
  type RowPins,
  type ScrollX,
  type SortBy,
  type TableGroup,
  type TableRender,
  type TableState,
  type VirtualRow,
} from './types';

/** `<Table>`'s props: its columns and rows, its state and the handlers that
 *  change it, its loading states, and the skin that draws it. */
export interface TableProps<T> {
  /** The columns, left to right. */
  columns: Column<T>[];
  /** The rows, in the order drawn: the table never reorders them. */
  rows: T[];
  /** Grouped rows. Mutually exclusive with `rows` in practice — when present it
   *  wins, and `rows` is ignored. */
  groups?: TableGroup<T>[];
  /** The sort, the dragged widths, the collapsed groups, the focused cell and
   *  the selection. `useTable` holds one. */
  state: TableState;
  /** Called with the next sort when a header is clicked. */
  onSortChange: (next: SortBy[]) => void;
  /** Called with a column's key and its new width as a resize handle moves. */
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
  /** Called with the row when a row is clicked. */
  onRowClick?: (row: T) => void;
  /** `Enter` on a focused cell that holds no widget of its own. */
  onRowActivate?: (row: T) => void;
  /** The rows are loading. With no rows it draws ten skeleton rows; with
   *  rows it changes nothing. */
  isLoading: boolean;
  /**
   * A reload running over rows that are already on screen.
   *
   * Distinct from `isLoading`, which means there is nothing to show yet and
   * gets skeletons. This one keeps every row exactly where it is, dims them,
   * and runs a progress line under the header — so nothing moves under the
   * pointer and a stale number is visibly stale.
   *
   * @default false
   */
  isRefreshing?: boolean;
  /** A failed load. The `error` slot replaces the body, under the header,
   *  until it is cleared. */
  error?: Error | null;
  /** Offered as the error state's one action. Optional, and the `error` slot
   *  draws no button without it — the engine has no idea how to retry a load
   *  it never performed, so the action exists only when the caller says what
   *  it does. */
  onRetry?: () => void;
  /** The filtered-empty state's one action. Same contract as `onRetry`: the
   *  page owns the filters (see `isFiltered`), so it is the only thing that
   *  can clear them. */
  onClearFilters?: () => void;
  /** The skin that draws every part: `tableRender<Row>()` from `@bh/ui`. */
  render: TableRender<T>;
  /** Height of a data row in pixels, or a function of the row and its index
   *  for rows of different heights. The virtualizer needs it up front, so a
   *  caller with a density toggle passes the height for the current mode.
   *
   *  A function gives per-row heights — a wrapped two-line title next to
   *  one-liners. It is asked BEFORE the row is rendered, so it must answer
   *  from the DATA; the engine cannot measure a row that does not exist yet.
   *  `row` is undefined where the row is not loaded.
   *
   *  @default 40 */
  rowHeight?: number | ((row: T | undefined, index: number) => number);
  /** Row-level chrome that is not a column — see `RenderTrCtx.overlay`. */
  rowOverlay?: (row: T) => ReactNode;
  /**
   * What the status bar says on the caller's behalf: "1–50 of 4,812", "page 2
   * of 97", "last refreshed 08:12".
   *
   * The engine can count the rows it was handed and the ones that are
   * selected, and it does. It cannot know how many rows exist on a server, or
   * which page of them this is, so that half of the bar comes from here.
   */
  status?: ReactNode;
  /** Whether a filter is responsible for there being no rows. Forwarded to the
   *  `empty` slot, which needs it to choose its copy. The engine cannot infer
   *  it: it receives rows, never the query that produced them.
   *
   *  @default false */
  isFiltered?: boolean;
  /** Called once the virtual window reaches the last rows, so a server-paged
   *  caller can fetch the next page. The engine does not know whether more
   *  rows exist or whether a fetch is already in flight — it only reports
   *  arrival at the end, and the caller decides what that is worth.
   *
   *  It fires on arrival, not on every scroll event within the end zone: the
   *  guard below remembers the row count it last fired at, so a caller that
   *  answers with more rows re-arms and one that answers with none does not
   *  spin. */
  onEndReached?: () => void;
  /** Pin the current group's band under the column header while its rows
   *  scroll past.
   *
   *  Opt-in, like focus, selection and collapsing — and for a sharper reason
   *  than those. It renders the band a SECOND time, which changes the DOM of
   *  every grouped table that already exists: a group's label suddenly appears
   *  twice. That is a change a caller should ask for.
   *
   *  @default false */
  stickyGroupHeader?: boolean;
}

/**
 * A sortable, resizable, virtualized table over an array of rows, drawn by a
 * skin. It reports what the user asks for (a sort, a width, a selection) and
 * leaves the rows as given.
 */
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
    isRefreshing = false,
    error,
    onRetry,
    onClearFilters,
    rowHeight = ROW_HEIGHT,
    rowOverlay,
    status,
    isFiltered = false,
    onEndReached,
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

  /**
   * The four elements the engine owns, and what each one is for.
   *
   * `frame` is the table as an OBJECT: the border, and the box whose height is
   * the whole table. `clip` hides the columns that do not fit — with
   * `overflow: clip`, which is the load-bearing choice in this whole
   * arrangement (see the render below). `sheet` is what slides sideways.
   * `rows` is the row container, needed only so the virtualizer can be told
   * where the rows begin inside the page.
   *
   * State rather than refs: every one of them feeds a measurement, and a ref
   * assignment does not re-render, so the first measurement would never
   * happen.
   */
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [clipEl, setClipEl] = useState<HTMLDivElement | null>(null);
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null);
  const [rowsEl, setRowsEl] = useState<HTMLElement | null>(null);

  const host = useScrollHost(frameEl, clipEl, sheetEl, rowsEl);

  /**
   * How far the table can slide sideways, and how far it has.
   *
   * The offset is CLAMPED on read rather than corrected in an effect: a column
   * that narrows while the table is scrolled to its right-hand end shortens
   * the travel, and a stored offset past the new end would otherwise leave a
   * strip of empty frame until something else moved.
   */
  /**
   * How wide the table really is.
   *
   * The measured total wins, because only layout knows what a flexible track
   * resolved to. Before the first measurement — and under a test renderer,
   * which does no layout at all — the authored widths are the best available
   * answer, and they are the same numbers the pinned offsets are already built
   * from. They can only understate a flexible column, never invent overflow
   * that is not there.
   */
  const sheetWidth =
    host.sheetWidth || columns.reduce((a, c) => a + startWidthOf(c, state.widths), 0);

  // A frame that has not been measured yet claims no overflow. Zero is not a
  // width, and "everything is hidden" is the worst possible guess to make
  // before the first layout.
  const maxSx = host.frameWidth > 0 ? Math.max(0, sheetWidth - host.frameWidth) : 0;

  /**
   * The columns are narrower than the frame, so there is empty table after the
   * last one — which means that column needs a rule on its right, the one edge
   * the between-columns rules never reach. See `RenderThCtx.trailing`.
   *
   * A pixel of tolerance, because a sub-pixel column width otherwise leaves a
   * table that visibly fills its frame claiming a sliver of empty space
   * forever.
   */
  const trailingSpace = host.frameWidth > 0 && sheetWidth > 0 && host.frameWidth - sheetWidth > 1;
  const lastColumn = columns.length - 1;
  const [storedSx, setSx] = useState(0);
  const sx = Math.min(storedSx, maxSx);

  /**
   * Which horizontal edges have content hidden past them.
   *
   * Derived now, not measured. It used to read `scrollWidth`/`scrollLeft` off
   * a scroll container in a passive effect, because those are only true after
   * layout; the two numbers it needs are already measured once, in
   * `useScrollHost`, and everything here is arithmetic on them.
   */
  const scrollX: ScrollX =
    maxSx <= 1 ? 'none' : sx <= 1 ? 'start' : sx >= maxSx - 1 ? 'end' : 'middle';

  // Read inside the native wheel listener, which is subscribed once per clip
  // element and would otherwise close over the offsets as they were on the
  // render that installed it.
  const sxRef = useRef(sx);
  sxRef.current = sx;
  const maxSxRef = useRef(maxSx);
  maxSxRef.current = maxSx;

  /**
   * Sideways wheeling, as a native listener rather than React's `onWheel`.
   *
   * React registers `wheel` PASSIVELY at the root, so `preventDefault` inside
   * an `onWheel` prop does nothing but log a warning — and without it a
   * trackpad swipe would scroll the table sideways and then hand the same
   * gesture to the page, which would scroll too.
   *
   * The event drives the scrollbar, not the offset: the bar's own `scroll`
   * event is the single place `sx` is set, so a wheel, a drag of the bar and a
   * click on its track all arrive by one path. A gesture that would go past
   * either end is left alone, so the page (or a horizontally scrolling
   * ancestor) still gets it.
   */
  useEffect(() => {
    if (!clipEl) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = sideways ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0) {
        return;
      }
      const next = Math.max(0, Math.min(maxSxRef.current, sxRef.current + delta));
      if (next === sxRef.current) {
        // At either end. Leave the gesture alone so the page still gets it.
        return;
      }
      e.preventDefault();
      setSx(Math.round(next));
    };
    clipEl.addEventListener('wheel', onWheel, { passive: false });
    return () => clipEl.removeEventListener('wheel', onWheel);
  }, [clipEl]);

  /**
   * How tall the dock is, so the totals row can pin directly above it rather
   * than underneath it. Measured after paint, like everything else here: the
   * scrollbar is only present while the table overflows, and the status bar is
   * the render set's to size.
   */
  /**
   * The thumb's geometry: as much of the track as the frame is of the table,
   * with a floor so a very wide table still leaves something to grab.
   */
  const thumbWidth =
    maxSx > 0 && sheetWidth > 0
      ? Math.max(MIN_THUMB_WIDTH, Math.round((host.frameWidth * host.frameWidth) / sheetWidth))
      : 0;
  const thumbSpan = Math.max(0, host.frameWidth - thumbWidth);
  const hbarDrag = useHbarDrag({
    sx,
    maxSx,
    span: thumbSpan,
    thumbWidth,
    onChange: setSx,
  });

  const [dockEl, setDockEl] = useState<HTMLDivElement | null>(null);
  const [dockHeight, setDockHeight] = useState(0);
  // Compared against a ref before the setter, not inside it — see the note on
  // `latest` in `useScrollHost` for why a no-op functional update is not
  // free while a drag is in flight.
  const dockHeightRef = useRef(0);
  useEffect(() => {
    const height = dockEl?.offsetHeight ?? 0;
    if (dockHeightRef.current !== height) {
      dockHeightRef.current = height;
      setDockHeight(height);
    }
  });

  /**
   * Keep the focused cell on screen sideways.
   *
   * Arrowing into a column that is off the right-hand edge used to be the
   * browser's problem: focus moves, the scroll container brings it into view.
   * A clipped box does no such thing, so the cell would take focus somewhere
   * nobody can see. The roving tabindex is what identifies it — there is
   * exactly one `tabindex="0"` in the table, and it is the focused cell.
   */
  const focusedColumn = state.focused?.columnKey;
  useEffect(() => {
    if (!clipEl || focusedColumn === undefined || maxSxRef.current <= 0) {
      return;
    }
    const cell = clipEl.querySelector<HTMLElement>('[tabindex="0"]');
    if (!cell) {
      return;
    }
    const left = cell.offsetLeft;
    const right = left + cell.offsetWidth;
    const view = clipEl.clientWidth;
    setSx((current) => {
      if (left < current) {
        return left;
      }
      if (right > current + view) {
        return Math.min(maxSxRef.current, right - view);
      }
      return current;
    });
  }, [clipEl, focusedColumn]);

  /**
   * Whether the scrollbar is worth showing.
   *
   * Three reasons to see it, and they are all "you are interacting with this
   * table": the pointer is over it, it is moving, or you have hold of the
   * thumb. A bar that is always drawn is one more line across every table;
   * one that never is cannot be discovered — this is the middle, and it is
   * also what the platform's own overlay scrollbars do.
   *
   * The movement half is a timer rather than a transition end, because the
   * offset can change from a wheel, a drag, a keyboard step or a column
   * resize, and all four should leave the bar up for a moment afterwards.
   */
  /**
   * Middle-click autoscroll, which the browser cannot give us here — see
   * `useMiddlePan`. Both axes, because taking the gesture over means the
   * native one never starts.
   */
  const panning = useMiddlePan({
    el: clipEl,
    scrollHost: host.el,
    // Rounded: the pan produces a fractional velocity per frame, and the
    // offset goes straight into a `margin-left` that every pinned column then
    // cancels against. Whole pixels on both sides of that sum keep a frozen
    // column from shimmering half a pixel as the table moves.
    onPanX: (dx) => {
      setSx((current) => Math.round(Math.max(0, Math.min(maxSxRef.current, current + dx))));
    },
  });

  /**
   * The column being resized right now, and how wide the drag is proposing to
   * make it.
   *
   * The handle lives in a header cell and the guideline has to cross the whole
   * table, so the cell reports and the engine draws — see
   * `RenderThResize.onDragChange`.
   *
   * `anchor` is the dragged column's left edge, measured ONCE when the drag
   * starts. It cannot move while the drag runs (only the column's width
   * changes, and only to its right), so measuring it per pointer move would be
   * a layout read per frame for a number that is already known.
   */
  const [resizeDrag, setResizeDrag] = useState<{ width: number; startWidth: number } | null>(null);
  const resizeAnchor = useRef(0);
  const onResizeDrag = (key: string, startWidth: number) => {
    return (width: number | null) => {
      if (width === null) {
        setResizeDrag(null);
        return;
      }
      setResizeDrag((current) => {
        if (!current) {
          // The header cell comes first in the DOM, so this finds the header's
          // copy of the column rather than a body cell's.
          const cell = clipEl?.querySelector<HTMLElement>(`[data-cell-col="${CSS.escape(key)}"]`);
          resizeAnchor.current = cell?.offsetLeft ?? 0;
        }
        return { width, startWidth };
      });
    };
  };

  /**
   * Which soft edges the table currently wants, and where each one sits.
   *
   * Three possible, never more than two at once. The freeze scrim marks the
   * boundary the frozen columns hold and only exists once something has
   * actually slid under them. The other two are the frame's own edges, and the
   * `start` one is suppressed when a freeze scrim is already drawn there —
   * they would be the same fade in the same place, twice as dark.
   */
  const frozenWidth = columns
    .filter((c) => c.pinned === 'left')
    .reduce((total, c) => total + startWidthOf(c, state.widths), 0);
  const scrims: { kind: 'freeze' | 'start' | 'end'; offset: number }[] = [];
  if (sx > 0 && frozenWidth > 0) {
    scrims.push({ kind: 'freeze', offset: frozenWidth });
  } else if (sx > 0) {
    scrims.push({ kind: 'start', offset: 0 });
  }
  if (maxSx > 0 && sx < maxSx - 1) {
    scrims.push({ kind: 'end', offset: 0 });
  }

  const [pointerOver, setPointerOver] = useState(false);
  const [recentlyMoved, setRecentlyMoved] = useState(false);
  // Only the first offset change of a gesture raises the flag; every one after
  // it just pushes the timer back. Calling the setter on each of them would
  // trip React's nested-update guard mid-drag — see `latest` in
  // `useScrollHost`.
  const recentlyMovedRef = useRef(false);
  useEffect(() => {
    if (maxSx <= 0) {
      return;
    }
    if (!recentlyMovedRef.current) {
      recentlyMovedRef.current = true;
      setRecentlyMoved(true);
    }
    const timer = setTimeout(() => {
      recentlyMovedRef.current = false;
      setRecentlyMoved(false);
    }, BAR_LINGER_MS);
    return () => clearTimeout(timer);
  }, [sx, maxSx]);

  const virtualizer = useVirtualizer({
    count: items.length,
    // The PAGE scrolls, not the table. `null` from the hook means no ancestor
    // scrolls, which is to say the document does — and that is an element too.
    getScrollElement: () => host.el ?? document.documentElement,
    // Everything above the first row that is not a row: the page above the
    // table, the frame's border, the column header. Without it the virtualizer
    // would believe row 0 sits at the top of the page and mount the wrong
    // window by exactly the height of whatever is above the table.
    scrollMargin: host.rowsTop,
    estimateSize: (i) => {
      const item = items[i];
      return item?.kind === 'group' ? GROUP_ROW_HEIGHT : heightOf(item?.index ?? i);
    },
    overscan: 8,
  });

  /**
   * Ask for the next page once the window is within `END_ZONE_ROWS` of the
   * last item, so the fetch overlaps the scroll instead of following it.
   *
   * `firedAtCount` is what keeps this from firing on every scroll frame inside
   * the end zone: it holds the item count the last call was made at, so the
   * next call waits for a count that differs from it. A page that arrives
   * re-arms it; a page that comes back empty leaves the count where it is and
   * the table stops asking, which is also what happens at the end of the list.
   */
  const lastVisibleIndex = virtualizer.getVirtualItems().at(-1)?.index;
  const firedAtCount = useRef(-1);
  useEffect(() => {
    if (!onEndReached || lastVisibleIndex === undefined || items.length === 0) {
      return;
    }
    if (firedAtCount.current === items.length) {
      return;
    }
    if (lastVisibleIndex < items.length - END_ZONE_ROWS) {
      return;
    }
    firedAtCount.current = items.length;
    onEndReached();
  }, [onEndReached, lastVisibleIndex, items.length]);

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
    // The clip box is the table's DOM root as far as focus is concerned: every
    // cell is inside it, and it is where focus parks when the focused row
    // scrolls out and unmounts. It is no longer where scrolling happens, which
    // is why the two responsibilities are now on different elements.
    scrollEl: clipEl,
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
        Math.floor((virtualizer.scrollRect?.height ?? host.viewportHeight ?? 0) / baseRowHeight),
      ),
    },
    scrollRowIntoView: (rowIndex) => {
      if (rowIndex < 0) {
        // The header row is sticky, but the PAGE still scrolls up to the top
        // of the table so the user sees where focus went. It is the page's
        // scroll position now, not the table's, and the target is the table's
        // own top rather than zero — everything above the table belongs to
        // somebody else. A property assignment rather than `scrollTo`, which
        // jsdom does not implement.
        if (host.el) {
          host.el.scrollTop = host.frameTop;
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

  const gridTemplate = columns.map((c) => trackSize(c, state.widths)).join(' ');
  const pins = pinOffsets(columns, state.widths, sx, maxSx);
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
    if (!clipEl) {
      return;
    }
    let widest = 0;
    for (const cell of clipEl.querySelectorAll<HTMLElement>('[data-cell-col]')) {
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

  /**
   * The filter row, present as soon as any column defines a `filter` and the
   * render set can draw one. Built here and handed to the header, which puts
   * it inside its own sticky box — see `RenderTheadCtx.filterRow`.
   */
  const filterRowNode: ReactNode =
    render.filterRow && columns.some((c) => c.filter !== undefined)
      ? render.filterRow({ columns, gridTemplate, trailing: trailingSpace, pins })
      : null;
  /** Rows above the data: the column header, and the filter row when there is
   *  one. What `aria-rowcount` and every data row's `aria-rowindex` count. */
  const headRowCount = filterRowNode === null ? 1 : 2;

  const headerNode = render.thead({
    gridTemplate,
    filterRow: filterRowNode ?? undefined,
    // Only while there are rows to be stale. A refresh with nothing on screen
    // is a load, and gets skeletons.
    refreshing: isRefreshing && items.length > 0,
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
                  onDragChange: onResizeDrag(col.key, colWidth),
                }
              : undefined
          }
          focused={focus.isFocused(HEADER_ROW, col.key)}
          focusProps={focus.focusPropsFor(HEADER_ROW, col.key)}
          pin={pins.get(col.key)}
          trailing={trailingSpace && colIndex === lastColumn}
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
   * sticky: the real band leaves the DOM once it scrolls out of the virtual
   * window, long before its group's last row has gone past. The engine decides
   * which group is active; where it sticks and what it looks
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

  let bodyNode: ReactNode;
  let stickyGroupNode: ReactNode = null;

  /**
   * The totals row, present as soon as any column defines one.
   *
   * Only alongside actual rows: a totals row over a skeleton, an error or an
   * empty state is summing nothing, and pinning "0" to the bottom of a table
   * that failed to load is worse than showing no total at all.
   */
  const footerNode: ReactNode =
    !error && !isLoading && items.length > 0 && columns.some((c) => c.footer !== undefined)
      ? render.tfoot({
          columns,
          gridTemplate,
          bottomOffset: dockHeight,
          trailing: trailingSpace,
          // The same map the header and the body cells are dealt entries of.
          // This row is inside the sheet and slides with it, so without them a
          // total scrolls out from under the column it totals.
          pins,
        })
      : null;
  if (error) {
    // A failure replaces the BODY, not the table. This used to return the
    // error slot on its own, which took the column header, the frame and the
    // scroll container with it — so a table that failed stopped looking like
    // a table at all, and the user lost every cue about what had failed to
    // load. The spec's A8 says the same thing about all four of these states:
    // the header stays, and only the rows are replaced.
    bodyNode = render.error({ error, onRetry });
  } else if (isLoading && items.length === 0) {
    bodyNode = Array.from({ length: 10 }).map((_, i) => {
      return (
        <RenderSkeletonRow
          key={i}
          columns={columns}
          gridTemplate={gridTemplate}
          trailing={trailingSpace}
          // A placeholder stands in for a row that has not arrived, so there
          // is no row to ask for a per-row height. The base height is the only
          // answer available and the right one.
          rowHeight={baseRowHeight}
          // A skeleton lays out on the same tracks as the rows it stands in
          // for, so its frozen columns have to be where theirs will be — a
          // table scrolled sideways while it loads otherwise jumps the moment
          // the data lands.
          pins={pins}
          slot={render.skeletonRow}
        />
      );
    });
  } else if (items.length > 0) {
    const virtualItems = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();
    /**
     * Virtualization by PADDING, not by absolutely positioning every row.
     *
     * Rows stay in normal flow as ordinary children of the rowgroup, and the
     * combined height of everything above and below the mounted window is
     * carried by the rowgroup's own padding. Document order then does the
     * stacking that `translateY` used to do by hand.
     *
     * Padding rather than two spacer elements because a `rowgroup` may own
     * nothing but rows — a bare div between them is the same CRITICAL
     * `aria-required-children` violation `renderGroupHeader` already
     * documents. Padding adds no node to the tree at all.
     *
     * What this buys beyond one less style per row: a row is a grid ITEM
     * again. An absolutely positioned element is out of flow and therefore
     * not a grid item, which is what made `subgrid` impossible — it computes
     * to `none` on anything that is not one.
     */
    // Both ends are measured from the ROWS, and the virtualizer measures from
    // the page: `scrollMargin` is baked into every item's start, so it comes
    // back off here. Without the subtraction the padding above the first
    // mounted row would also contain everything above the table.
    const padStart = (virtualItems[0]?.start ?? 0) - host.rowsTop;
    const padEnd = totalSize - ((virtualItems[virtualItems.length - 1]?.end ?? 0) - host.rowsTop);
    bodyNode = render.tbody({
      ref: setRowsEl,
      totalSize,
      style: { paddingTop: Math.max(0, padStart), paddingBottom: Math.max(0, padEnd) },
      children: virtualItems.map((vi) => {
        const item = items[vi.index];
        if (!item) {
          return null;
        }

        // Height only. Position is flow order now, and the distance from the
        // top of the scroll region is the rowgroup's padding.
        const style: CSSProperties = {
          height: item.kind === 'group' ? GROUP_ROW_HEIGHT : heightOf(item.index),
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
        const cells = columns.map((col, colIndex) => {
          return (
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
                trailing: trailingSpace && colIndex === lastColumn,
              })}
            </Fragment>
          );
        });
        return (
          <RenderTr
            key={vi.key}
            row={item.row}
            index={rowIndex}
            ariaRowIndex={rowIndex + headRowCount + 1}
            cells={cells}
            gridTemplate={gridTemplate}
            style={style}
            onClick={onRowClick ? () => onRowClick(item.row) : undefined}
            overlay={rowOverlay ? rowOverlay(item.row) : undefined}
            selected={rowId !== null && selectedIds.has(rowId)}
            hasPinned={hasPinned}
            dimmed={isRefreshing}
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
          belowFilterRow: filterRowNode !== null,
          collapsed: Boolean(collapsedKeys?.has(stickyGroup.key)),
          onToggle: toggleGroup ? () => toggleGroup(stickyGroup.key) : undefined,
        })
      : null;
  } else {
    // Not loading, no error, nothing to show. Rendered INSIDE root so the empty
    // state sits under the column header and within the scroll container,
    // rather than beside the table where a caller would otherwise have to put
    // it — losing the header above it.
    bodyNode = render.empty({ filtered: isFiltered, onClearFilters });
  }

  return (
    <div
      ref={setFrameEl}
      data-slot="table-frame"
      // The scroll state is on the element as an attribute AND in the class
      // the render set chose: the attribute is what a test and a screenshot
      // can read, the class is what a person sees.
      data-scroll-x={scrollX}
      className={joinClasses('relative flex w-full flex-col', render.frameClass?.({ scrollX }))}
      // What brings the scrollbar out. The whole table, not the bar itself:
      // a bar you have to already be on top of to see is a bar you cannot
      // find, and the pointer being anywhere over the table is the moment
      // "can this go sideways?" becomes a live question.
      onPointerEnter={() => setPointerOver(true)}
      onPointerLeave={() => setPointerOver(false)}
      // The table fills what is left of the viewport and grows from there, so
      // a five-row table does not leave its status bar stranded halfway up the
      // page while a five-thousand-row one simply runs on. `MIN_FRAME_HEIGHT`
      // is the floor for a table that starts below the fold, where the
      // subtraction would otherwise go to nothing.
      style={{
        minHeight: Math.max(MIN_FRAME_HEIGHT, host.viewportHeight - host.frameTop),
      }}
    >
      <div
        ref={setClipEl}
        data-slot="table-scroll"
        /**
         * `overflow-clip`, and emphatically not `overflow-auto` or `hidden`.
         *
         * This one property is what lets the page do the scrolling. A box with
         * `auto` or `hidden` overflow IS a scroll container, and `position:
         * sticky` answers to the nearest scroll container — so a sticky header
         * inside one sticks to the top of the TABLE, which scrolls out of
         * sight with everything else. `clip` hides the overflow without
         * creating a scrollport, so the header, the pinned group bands and the
         * totals row all answer to the page instead and stay where the design
         * puts them.
         *
         * `grow` with the default `auto` basis, never `flex-1`: a zero basis
         * would make this box the leftover space of the frame, and the sheet
         * inside it — all ten thousand rows of it — would be clipped to one
         * viewport.
         */
        className="relative grow overflow-clip"
        data-panning={panning ? 'true' : undefined}
        // The one cursor the engine sets itself. It is not decoration: while
        // a middle-click pan is running the pointer is no longer pointing at
        // anything, and this is the only thing on screen that says so.
        style={panning ? PANNING_CURSOR : undefined}
        // -1, never 0: this is not a tab stop, it is where DOM focus is PARKED
        // when the focused row is scrolled out and unmounted. Without it focus
        // would fall to <body> and the user would lose their place entirely.
        tabIndex={onFocusChange ? -1 : undefined}
        onKeyDown={focus.onKeyDown}
        onFocusCapture={focus.onFocusCapture}
        onBlurCapture={focus.onBlurCapture}
      >
        <div
          ref={setSheetEl}
          data-slot="table-sheet"
          // The sheet is the table's whole width, slid left by however far it
          // is scrolled. `width` is the resolved track total once the columns
          // overflow, so a row's own background reaches the last column rather
          // than stopping where the visible area does; while everything fits
          // it is plain `100%` and the grid divides that up as it always has.
          // `relative` so the resize guideline resolves against the sheet
          // rather than the clip box — which means it slides with the columns
          // for free, and stays on the edge it is marking.
          className="relative"
          style={{
            marginLeft: -sx,
            width: maxSx > 0 ? sheetWidth : '100%',
          }}
        >
          {render.root({
            gridTemplate,
            // Plus the header rows: `aria-rowcount` counts every row a user
            // can land on, and the column header is one of them — it is
            // addressable at rowIndex -1 and is where sorting lives. The
            // filter row, when there is one, is another.
            rowCount: itemIndexOfRow.length + headRowCount,
            colCount: columns.length,
            children: (
              <>
                {headerNode}
                {stickyGroupNode}
                {bodyNode}
                {footerNode}
              </>
            ),
          })}
          {/* Over the rows and the header both, which is the entire point of
              it: a column edge is a vertical thing, and the only way to see
              where one will land is to draw the whole line. */}
          {resizeDrag
            ? render.resizeGuide?.({
                left: resizeAnchor.current + resizeDrag.width,
                width: resizeDrag.width,
                delta: resizeDrag.width - resizeDrag.startWidth,
              })
            : null}
        </div>
      </div>
      {/* The scrims, on the FRAME rather than inside the clip: they mark where
          the table's visible area ends, so they must not slide with it. */}
      {scrims.map((scrim) => {
        return (
          <Fragment key={scrim.kind}>{render.scrim?.({ ...scrim, bottom: dockHeight })}</Fragment>
        );
      })}
      {/* The dock: everything pinned to the bottom of the table, in one
          sticky box. One box rather than two sticky siblings because the
          scrollbar has to sit directly above the status bar, and two
          independently-stuck elements would have to know each other's height
          to manage it. */}
      <div data-slot="table-dock" className="sticky bottom-0 z-20" ref={setDockEl}>
        {/* The table's horizontal scrollbar, drawn rather than native and
            moved to where it can be reached. The clip box cannot have one —
            that is the whole point of it — and a scrollbar at the natural
            bottom of a ten-thousand-row table is one nobody will ever see. */}
        {maxSx > 0
          ? render.hbar?.({
              thumbWidth,
              thumbOffset: thumbSpan > 0 ? Math.round((sx / maxSx) * thumbSpan) : 0,
              dragging: hbarDrag.dragging,
              // `panning` on its own, because a click-and-go pan keeps running
              // with the pointer off the table entirely.
              visible: pointerOver || recentlyMoved || hbarDrag.dragging || panning,
              thumbProps: hbarDrag.thumbProps,
              trackProps: hbarDrag.trackProps,
            })
          : null}
        {render.statusBar?.({
          rowCount: itemIndexOfRow.length,
          selectedCount: selectedIds.size,
          sort: state.sort,
          status,
        })}
      </div>
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
function pinOffsets<T>(
  columns: Column<T>[],
  widths: Record<string, number>,
  /** How far the sheet has slid, and how far it can slide in total. */
  sx: number,
  maxSx: number,
): Map<string, CellPin> {
  const pins = new Map<string, CellPin>();
  const left = columns.filter((c) => c.pinned === 'left');
  const right = columns.filter((c) => c.pinned === 'right');

  // A left-pinned column cancels the slide exactly: the sheet has moved `sx`
  // to the left, so the cell moves `sx` back to the right and lands where it
  // started. A right-pinned one cancels what is LEFT of the slide — at the far
  // end of the travel the sheet's right edge is already at the frame's right
  // edge, so nothing is owed and the shift is zero.
  let offset = 0;
  for (const [i, col] of left.entries()) {
    pins.set(col.key, { side: 'left', offset, shift: sx, edge: i === left.length - 1 });
    offset += startWidthOf(col, widths);
  }
  offset = 0;
  for (const [i, col] of [...right].reverse().entries()) {
    pins.set(col.key, {
      side: 'right',
      offset,
      shift: sx - maxSx,
      edge: i === right.length - 1,
    });
    offset += startWidthOf(col, widths);
  }
  return pins;
}

/** Shared empty set, so a table with no selection does not hand a fresh
 *  object to every row on every render. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

/** How close to the last item the virtual window gets before `onEndReached`. */
const END_ZONE_ROWS = 10;

/**
 * The shortest a table is allowed to be, in pixels.
 *
 * The frame otherwise fills whatever is left of the viewport below where the
 * table starts — which for a table halfway down a long page is nothing at all,
 * or a negative number. Four rows and the chrome around them is a table that
 * still reads as one.
 */
const MIN_FRAME_HEIGHT = 200;

/** How long the scrollbar stays up after the table stops moving. Long enough
 *  to see where you landed, short enough not to sit there. */
const BAR_LINGER_MS = 900;

/** The scrollbar thumb's floor. Proportional below this and a table of a
 *  hundred columns would offer a two-pixel target. */
const MIN_THUMB_WIDTH = 32;

/** Frozen so a pan does not hand the clip box a new style object every frame. */
const PANNING_CURSOR: CSSProperties = Object.freeze({ cursor: 'all-scroll' });

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
    onDragChange?: (width: number | null) => void;
  };
  focused: boolean;
  focusProps: CellFocusProps;
  pin?: CellPin;
  trailing?: boolean;
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
    trailing: props.trailing,
    children: props.content,
  });
}

function RenderTr<T>(props: {
  row: T;
  index: number;
  ariaRowIndex: number;
  cells: ReactNode;
  gridTemplate: string;
  style: CSSProperties;
  onClick?: () => void;
  overlay?: ReactNode;
  selected?: boolean;
  hasPinned?: boolean;
  dimmed?: boolean;
  slot: TableRender<T>['tr'];
}): ReactNode {
  return props.slot({
    row: props.row,
    index: props.index,
    ariaRowIndex: props.ariaRowIndex,
    cells: props.cells,
    gridTemplate: props.gridTemplate,
    style: props.style,
    onClick: props.onClick,
    overlay: props.overlay,
    selected: props.selected,
    hasPinned: props.hasPinned,
    dimmed: props.dimmed,
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
  trailing?: boolean;
  pins: RowPins;
  slot: TableRender<T>['skeletonRow'];
}): ReactNode {
  return props.slot({
    columns: props.columns,
    gridTemplate: props.gridTemplate,
    rowHeight: props.rowHeight,
    trailing: props.trailing,
    pins: props.pins,
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
  if (dragged !== undefined) {
    return `${dragged}px`;
  }
  if (typeof col.width === 'string') {
    return col.width;
  }
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
  if (dragged !== undefined) {
    return dragged;
  }
  if (typeof col.width === 'number') {
    return col.width;
  }
  if (typeof col.width === 'string') {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(col.width.trim());
    if (px) {
      return Number(px[1]);
    }
  }
  return 160;
}
