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
}

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
  | { kind: 'group'; key: string; header: ReactNode }
  | { kind: 'row'; row: T; index: number };

export interface RenderGroupHeaderCtx {
  key: string;
  header: ReactNode;
  gridTemplate: string;
  /** Virtualization positioning. MUST be applied or the header will not appear. */
  style: CSSProperties;
}
