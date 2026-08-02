import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export interface SortBy<F extends string = string> {
  field: F;
  direction: 'asc' | 'desc';
}

export type Renderer<V = unknown> = (props: { value: V; row: unknown }) => ReactNode;

export interface Column<T> {
  key: string;
  header: string;
  value?: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  as?: Renderer<any>;
  sortable?: boolean;
  /** Track size for this column. A number is pixels. A string is emitted into
   *  grid-template-columns verbatim, so `minmax(240px, 1fr)` and other track
   *  functions work — a flexible column cannot be expressed as a number.
   *  A width the user has dragged always wins over both. */
  width?: number | string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  resizable?: boolean;
  /**
   * This column's cell in the totals row pinned to the bottom of the table.
   * A footer row appears as soon as any column defines one; columns that do
   * not simply leave their cell blank.
   *
   * A finished ReactNode, not an aggregate function, for the same reason the
   * engine reports sort intent instead of sorting: it holds no opinion about
   * what the data means. A sum, a count, a mean and "3 of 40 selected" are all
   * the caller's arithmetic — and under windowed loading the engine would be
   * aggregating whatever chunk it happened to have, which is worse than not
   * offering it at all.
   */
  footer?: ReactNode;
  /**
   * The row-selection checkbox column. The engine owns this column's content —
   * `value`, `render` and `as` are ignored — because only the engine knows
   * which rows are selected, and the checkbox itself is drawn by the render
   * set's `selectCell` slot so no glyph leaks into the engine.
   */
  select?: boolean;
  /**
   * Freeze this column against the horizontal scroll.
   *
   * Implemented with `position: sticky` on the cell, NOT by splitting the
   * table into separate panes. We lay out on one CSS Grid, so a pinned column
   * keeps its track in the template and every row stays a single grid row —
   * panes would mean three virtualizers, three scroll positions to keep in
   * step, and rows that can drift apart vertically.
   *
   * A pinned column needs a resolvable pixel width, because the engine has to
   * add those widths up to know where the next pinned column starts. A track
   * function like `minmax(240px, 1fr)` has no such width and falls back to the
   * same 160px default the resize handle uses.
   */
  pinned?: 'left' | 'right';
}

/** Where a pinned cell sticks, and how far in. Computed by the engine, which
 *  is the only thing that knows the column order and the current widths. */
export interface CellPin {
  side: 'left' | 'right';
  /** Pixels from that edge — the widths of the pinned columns outside it. */
  offset: number;
  /** The innermost pinned column on this side, i.e. the one that borders the
   *  scrolling middle. The edge treatment goes here and nowhere else. */
  edge: boolean;
}

/**
 * How far the table is scrolled horizontally.
 *
 * `none` means it all fits. The other three say which edges have content
 * hidden beyond them, which is what an edge treatment has to know.
 */
export type ScrollX = 'none' | 'start' | 'middle' | 'end';

/**
 * One focused cell. Two deliberate asymmetries:
 *
 * - **Column KEY, not index**, so focus survives hiding, reordering and
 *   pinning a column.
 * - **Row INDEX, not id**, because focus is positional: under windowed
 *   loading the row at an index may not be fetched yet, and changing the sort
 *   resets the window anyway, so id stability buys nothing.
 *
 * `rowIndex: -1` addresses the HEADER row. That is what lets `↑` from row 0
 * reach the column headers instead of dead-ending, and it is the only reason
 * sorting is reachable from the keyboard at all.
 */
export interface CellRef {
  rowIndex: number;
  columnKey: string;
}

/**
 * MUST be spread onto the element a `th` or `td` slot renders.
 *
 * `tabIndex` is the roving tab stop — 0 on the focused cell, -1 everywhere
 * else — and is omitted entirely when the caller has not opted into the focus
 * model, so a table without it keeps whatever tab behaviour it had.
 *
 * The two data attributes are the engine's only handle on a cell it did not
 * create. Virtualization unmounts rows, so a React ref would go stale; the
 * coordinates let the engine find the cell again by address after it
 * remounts.
 */
export interface CellFocusProps {
  tabIndex?: number;
  'data-cell-row': number;
  'data-cell-col': string;
}

/**
 * Everything the table's chrome is driven by, in one object.
 *
 * One bag rather than a prop per concern: a caller spreads `useTable()`'s
 * result onto `<Table>` and gets all of it, and a controlled caller replaces
 * exactly the fields it wants to own. Every field past `sort` and `widths` is
 * optional so a caller can adopt them one at a time.
 */
export interface TableState {
  sort: SortBy[];
  widths: Record<string, number>;
  /** Keys of the collapsed groups. Carried here so a caller does not have to
   *  invent its own place to keep it; the engine does not yet act on it. */
  collapsed?: Set<string>;
  /** The focused cell. Supplying `onFocusChange` is what turns the focus
   *  model on; without it the engine leaves the tab order alone. */
  focused?: CellRef | null;
  /** Selected row IDs. Ids and not indices: under sort, filter and windowed
   *  loading the row at index 4 is not the row it was a moment ago. */
  selected?: Set<string>;
}

export interface RenderRootCtx {
  children: ReactNode;
}

export interface RenderTheadCtx {
  children: ReactNode;
  gridTemplate: string;
}

export interface RenderThResize {
  startWidth: number;
  minWidth?: number;
  onWidthChange: (px: number) => void;
  /** Size the column to its widest RENDERED cell — the double-click gesture on
   *  the handle. Measured, not estimated: only the DOM knows how wide "Add a
   *  retry budget to the outbox worker" actually is in this font at this
   *  weight. Only the mounted rows are measured, which is the honest answer
   *  for a virtualized table. */
  onAutoFit: () => void;
}

export interface RenderThCtx<T> {
  column: Column<T>;
  /** Zero-based position of this column in `columns`. A render set needs it to
   *  treat the leading column differently from the rest (the design's wider
   *  edge gutter); `column.key` cannot answer "am I first?". */
  index: number;
  sort?: { direction: 'asc' | 'desc'; index: number };
  totalSorts: number;
  onSortClick: (e: MouseEvent) => void;
  resize?: RenderThResize;
  /** This header cell holds the grid's focus. The ring is the ADAPTER's to
   *  draw — the engine has no business owning a colour. */
  focused?: boolean;
  /** MUST be spread onto the header cell element. */
  focusProps: CellFocusProps;
  /** Set when `column.pinned` is. The adapter turns it into `position: sticky`
   *  plus an offset; the engine supplies the arithmetic, never the CSS. */
  pin?: CellPin;
  /** Content to render INSTEAD of `column.header`, when the engine owns what
   *  goes in the header cell. Today that means one thing: the select-all
   *  checkbox above a `select` column. Mirrors `RenderTdCtx.children`. */
  children?: ReactNode;
}

export interface RenderTbodyCtx {
  children: ReactNode;
  totalSize: number;
}

export interface RenderTrCtx<T> {
  row: T;
  index: number;
  cells: ReactNode;
  gridTemplate: string;
  /** Virtualization positioning. MUST be applied or the row will not appear. */
  style: CSSProperties;
  onClick?: () => void;
  /** Row-level chrome that is NOT a column — hover actions floating over the
   *  row's right edge, a peek hint. Rendered after the cells, inside the row,
   *  which the virtualizer has already positioned; an absolutely-positioned
   *  overlay therefore resolves against the row rather than the page.
   *
   *  This exists so such chrome does not have to become a column and reserve
   *  permanent width for something only visible on hover. */
  overlay?: ReactNode;
  /** This row is in the selection. The treatment is the ADAPTER's to choose. */
  selected?: boolean;
  /** Some column in this table is pinned.
   *
   *  A pinned cell has to be opaque or the rows sliding beneath it show
   *  through, and the only way for it to stay in step with the row's hover and
   *  selected tints is `background: inherit` — which needs the ROW to have a
   *  real background rather than the transparent one it can otherwise get away
   *  with. This says when that applies, so a table with no pinned column keeps
   *  exactly the background it had. */
  hasPinned?: boolean;
}

/**
 * The selection checkbox, in a row or above the column. The engine knows what
 * is selected; the render set knows what a checkbox looks like, and that is
 * the whole division here.
 */
export interface RenderSelectCellCtx {
  checked: boolean;
  /** Header only: some rows are selected but not all. */
  indeterminate?: boolean;
  /** True for the select-all cell in the column header. */
  isHeader: boolean;
  /** `shiftKey` is what turns a click into a range — see `TableProps`. */
  onChange: (shiftKey: boolean) => void;
  /** Accessible name. A checkbox column shows no visible label, so a render
   *  set MUST attach this or every checkbox in the table is anonymous. */
  label: string;
}

export const ROW_HEIGHT = 40;

export interface RenderTdCtx<T> {
  column: Column<T>;
  /** Zero-based column position, matching `RenderThCtx.index` — a cell has to
   *  reach the same gutter decision its header did or the two fall out of
   *  alignment. */
  index: number;
  row: T;
  /** Cell content from `column.render(row)` / `column.as({...})` / stringified `column.value(row)`. */
  children: ReactNode;
  /** This cell holds the grid's focus. The ring is the ADAPTER's to draw. */
  focused?: boolean;
  /** MUST be spread onto the cell element. */
  focusProps: CellFocusProps;
  /** Set when `column.pinned` is — see `RenderThCtx.pin`. */
  pin?: CellPin;
}

export interface RenderSkeletonRowCtx<T> {
  columns: Column<T>[];
  gridTemplate: string;
  /** The caller's data row height, so a placeholder is the same height as the
   *  real rows it stands in for (e.g. a compact density's 32px rather than
   *  the engine's ROW_HEIGHT default). */
  rowHeight: number;
}

export interface RenderErrorCtx {
  error: Error;
}

/** The totals row. One slot rather than a row slot plus a cell slot: its
 *  content comes entirely from `column.footer`, so there is nothing per-cell
 *  for the engine to hand over that the render set cannot read off the column
 *  itself. */
export interface RenderTfootCtx<T> {
  columns: Column<T>[];
  gridTemplate: string;
}

export interface RenderEmptyCtx {
  /** Why the table is empty. "Nothing here yet" and "your filters hide
   *  everything" need different copy and different actions, and only the
   *  caller knows which applies — the engine is handed rows, not a query. */
  filtered: boolean;
}

export interface TableRender<T = unknown> {
  root: (ctx: RenderRootCtx) => ReactNode;
  thead: (ctx: RenderTheadCtx) => ReactNode;
  th: (ctx: RenderThCtx<T>) => ReactNode;
  tbody: (ctx: RenderTbodyCtx) => ReactNode;
  tr: (ctx: RenderTrCtx<T>) => ReactNode;
  td: (ctx: RenderTdCtx<T>) => ReactNode;
  groupHeader: (ctx: RenderGroupHeaderCtx) => ReactNode;
  skeletonRow: (ctx: RenderSkeletonRowCtx<T>) => ReactNode;
  error: (ctx: RenderErrorCtx) => ReactNode;
  empty: (ctx: RenderEmptyCtx) => ReactNode;
  tfoot: (ctx: RenderTfootCtx<T>) => ReactNode;
  /** Optional: a render set that does not draw checkboxes simply cannot host
   *  a `select` column, rather than every existing render set breaking. */
  selectCell?: (ctx: RenderSelectCellCtx) => ReactNode;
  /**
   * Classes for the SCROLL CONTAINER, given how far it is scrolled.
   *
   * A className rather than a node, because this is the one element the engine
   * cannot hand over: it carries the scroll ref, the keyboard handler and the
   * focus parking spot. But the engine has no business choosing what a scroll
   * edge looks like either, so the render set names the classes and the engine
   * only says when.
   */
  scrollClass?: (ctx: { scrollX: ScrollX }) => string;
}

/** Height of a group header row in pixels. Exported so the adapter styling and
 *  the virtualizer's size estimate cannot disagree — if they do, every row
 *  below the first group sits at the wrong offset. */
export const GROUP_ROW_HEIGHT = 34;

export interface TableGroup<T> {
  key: string;
  header: ReactNode;
  rows: T[];
}

/** One entry in the flattened, virtualized list. Group headers and data rows
 *  share a single virtualizer so the table keeps one scroll region. */
export type VirtualRow<T> =
  { kind: 'group'; key: string; header: ReactNode } | { kind: 'row'; row: T; index: number };

export interface RenderGroupHeaderCtx {
  key: string;
  header: ReactNode;
  gridTemplate: string;
  /** Virtualization positioning. MUST be applied or the header will not appear. */
  style: CSSProperties;
  /** Whether this group's rows are hidden. */
  collapsed: boolean;
  /** True for the extra copy pinned under the column header. The virtualizer
   *  positions every real band absolutely, and `position: sticky` does nothing
   *  on an absolutely positioned element — so the pinned band is a second
   *  rendering, and `style` is empty for it. The render set decides where it
   *  sticks and what it looks like. */
  sticky?: boolean;
  /** Absent when the caller supplies no `onCollapseChange` — collapsing is
   *  opt-in, like focus and selection, so a band that cannot collapse must not
   *  render a disclosure control that does nothing. */
  onToggle?: () => void;
}
