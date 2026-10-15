import type {
  CSSProperties,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';

/**
 * One column's place in a sort: the column and its direction. A table's sort
 * is a list of these, the first the primary key, each later one breaking the
 * ties of those before it.
 */
export interface SortBy<F extends string = string> {
  /** The sorted column's `key`. */
  field: F;
  /** `asc` or `desc`. A column sorted neither way is not in the list. */
  direction: 'asc' | 'desc';
}

/**
 * Draws a cell from its value and its row: what a column's `as` takes.
 * `@bh/ui`'s column helpers (`TextColumn()`, `NumberColumn()`, ...) each
 * return one.
 */
export type Renderer<V = unknown> = (props: { value: V; row: unknown }) => ReactNode;

/**
 * One column: what its header says, how a cell is drawn from a row, and how
 * the column sorts, sizes and sticks. A cell draws `render(row)`, else
 * `as({ value: value(row), row })`, else `value(row)` as text.
 */
export interface Column<T> {
  /** Names the column in the sort, the widths, the focused cell and the
   *  pins. Unique within the table. */
  key: string;
  /** The header cell's label. */
  header: string;
  /** The cell's value for a row: what `sortRows` compares, what `as` is
   *  handed, and what is drawn as text when there is neither `render` nor
   *  `as`. */
  value?: (row: T) => unknown;
  /** Draws the cell from the row. Wins over `as` and `value`. */
  render?: (row: T) => ReactNode;
  /** Draws the cell from `{ value, row }`, `value` being `value(row)`: a
   *  `Renderer`, such as `@bh/ui`'s `NumberColumn()`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  as?: Renderer<any>;
  /** A header click sorts by this column. The table reports the sort through
   *  `onSortChange`; ordering the rows is the caller's. */
  sortable?: boolean;
  /** Track size for this column. A number is pixels. A string is emitted into
   *  grid-template-columns verbatim, so `minmax(240px, 1fr)` and other track
   *  functions work — a flexible column cannot be expressed as a number.
   *  A width the user has dragged always wins over both, and 160 pixels is
   *  the width without either. */
  width?: number | string;
  /** The narrowest a drag or a double-click fit may make the column, in
   *  pixels. A drag stops at 64 without one. */
  minWidth?: number;
  /** Where the cells' content sits. The skin applies it. */
  align?: 'left' | 'right' | 'center';
  /** `false` takes the column's resize handle away. Every other column can be
   *  resized. */
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
   * This column's cell in the filter row, drawn directly under the column
   * header. The row appears as soon as any column defines one (and the render
   * set has a `filterRow` slot); columns that do not leave their cell blank.
   *
   * A finished node for the reason `footer` is one: the engine holds no
   * opinion about what a condition is. The caller builds the control, the
   * engine only puts it under the right column and keeps it there as the table
   * slides and sticks.
   */
  filter?: ReactNode;
  /**
   * Drawn in this column's header cell, after the label — a filter funnel.
   *
   * The render set keeps it out of the sort control, so a click on it never
   * sorts, and wraps it in an element carrying `HEADER_ACCESSORY_ATTR`, which
   * is how the keyboard reaches it: Alt+↓ on a focused header cell activates
   * the first control inside.
   */
  headerAccessory?: ReactNode;
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
   * Implemented by shifting the cell against the slide (see `CellPin.shift`),
   * NOT by splitting the table into separate panes. We lay out on one CSS
   * Grid, so a pinned column keeps its track in the template and every row
   * stays a single grid row — panes would mean three virtualizers, three
   * scroll positions to keep in step, and rows that can drift apart
   * vertically.
   *
   * A pinned column needs a resolvable pixel width, because the engine adds
   * those widths up for each pin's `offset` and for where the frozen part ends.
   * A track function like `minmax(240px, 1fr)` has no such width and falls
   * back to the same 160px default the resize handle uses.
   */
  pinned?: 'left' | 'right';
}

/** Where a pinned cell sticks, and how far in. Computed by the engine, which
 *  is the only thing that knows the column order and the current widths. */
export interface CellPin {
  /** The edge the column is frozen to: its `pinned`. */
  side: 'left' | 'right';
  /** Pixels from that edge — the widths of the pinned columns outside it. */
  offset: number;
  /**
   * How far to shift this cell so it appears not to move, in pixels.
   *
   * A frozen column used to be `position: sticky`, which needs a scrollport to
   * stick to. The table no longer has one — the page scrolls vertically and
   * the columns are slid sideways under a clip — so the engine, which is the
   * only thing that knows how far the sheet has slid, hands over the number
   * and the render set applies it as `position: relative; left: <shift>px`.
   *
   * It is the same value for every column on a side (the sheet's own offset
   * for the left, and what is left of the travel for the right), because they
   * are all cancelling out one slide. `offset` is still what says where the
   * column sits relative to its edge, and is what the freeze line is drawn
   * from.
   */
  shift: number;
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

// Two deliberate asymmetries. Column KEY, not index, so focus survives
// hiding, reordering and pinning a column. Row INDEX, not id, because focus is
// positional: under windowed loading the row at an index may not be fetched
// yet, and changing the sort resets the window anyway, so id stability buys
// nothing.
/**
 * The address of one cell: its row's index and its column's key. The column
 * is named, so focus stays in it when columns are hidden, moved or pinned;
 * the row is a position, so after a sort focus stays where it was on screen.
 *
 * `rowIndex: -1` is the header row: `↑` from the first row reaches the
 * headers, where Enter sorts.
 */
export interface CellRef {
  /** The row's place among the rows on screen, from 0; -1 for the header. */
  rowIndex: number;
  /** The column's `key`. */
  columnKey: string;
}

// A React ref would go stale the moment a row scrolls away and unmounts; the
// coordinates let the engine find the cell again by address.
/**
 * What a skin MUST spread onto the element its `th` or `td` slot renders.
 *
 * `tabIndex` is the roving tab stop — 0 on the focused cell, -1 everywhere
 * else — and is omitted entirely when the caller has not opted into the focus
 * model, so a table without it keeps whatever tab behaviour it had.
 *
 * The two data attributes are how the table finds a cell again after
 * virtualization has unmounted and remounted its row.
 */
export interface CellFocusProps {
  /** 0 on the one cell that is the grid's tab stop, -1 on the rest; absent
   *  when the table has no focus model. */
  tabIndex?: number;
  /** The cell's `CellRef.rowIndex`. */
  'data-cell-row': number;
  /** The cell's `CellRef.columnKey`. */
  'data-cell-col': string;
}

// One bag rather than a prop per concern: a caller spreads `useTable()`'s
// result onto `<Table>` and gets all of it, and a controlled caller replaces
// exactly the fields it wants to own.
/**
 * Everything the table is drawn from that changes as it is used: the sort,
 * the dragged widths, the collapsed groups, the focused cell and the
 * selection. `useTable` holds one; a caller that owns a field passes its own.
 *
 * Every field past `sort` and `widths` is optional, so a caller can adopt
 * them one at a time.
 */
export interface TableState {
  /** The sort, primary key first. Empty when nothing sorts. */
  sort: SortBy[];
  /** Widths the user has dragged, in pixels, by column key. They win over
   *  each column's own `width`. */
  widths: Record<string, number>;
  /** Keys of the collapsed groups. A collapsed group keeps its band and
   *  drops its rows. */
  collapsed?: Set<string>;
  /** The focused cell. Supplying `onFocusChange` is what turns the focus
   *  model on; without it the engine leaves the tab order alone. */
  focused?: CellRef | null;
  /** Selected row IDs. Ids and not indices: under sort, filter and windowed
   *  loading the row at index 4 is not the row it was a moment ago. */
  selected?: Set<string>;
}

/** What the `root` slot is handed: the element every other part of the table
 *  is drawn inside, `role="grid"` in `@bh/ui`. */
export interface RenderRootCtx {
  /** The header, the body, and the totals row when there is one. */
  children: ReactNode;
  /**
   * The column tracks, for a render set that wants to declare them ONCE for
   * the whole table rather than on every row.
   *
   * The same string every other slot gets. It is offered here because a
   * resize changes it on every pointer move, and a render set that writes it
   * per row therefore rewrites one `style` attribute per mounted row per
   * frame — around twenty DOM mutations a frame, which is invisible on its own
   * but is what makes dragging a column crawl with devtools open, since every
   * mutation is reported over the inspector protocol.
   *
   * Publishing it here as a CSS custom property and having rows inherit it
   * turns that into a single mutation. The default render set does exactly
   * that; `gridTemplate` stays on the row slots for sets that would rather
   * not, and for tests that assert on it.
   */
  gridTemplate: string;
  /**
   * The table's TRUE size, header row included — what `aria-rowcount` and
   * `aria-colcount` must report.
   *
   * Virtualization is exactly why the engine has to supply these. Around
   * eighteen rows exist in the DOM at any moment, so assistive technology
   * counting what it can see reports a 10,000-row table as eighteen rows. Only
   * the engine knows the real number, and a grid that lies about its own size
   * leaves a screen-reader user no way to tell where in it they are.
   */
  rowCount: number;
  /** The number of columns, for `aria-colcount`. */
  colCount: number;
}

/** What the `thead` slot is handed: the header row around its cells, and the
 *  filter row when there is one. */
export interface RenderTheadCtx {
  /** The header cells, one `th` slot per column. */
  children: ReactNode;
  /** The columns' `grid-template-columns`: each column's dragged width, else
   *  its `width`, else `160px`. */
  gridTemplate: string;
  /** Rows are on screen and a fresh page is on its way. The header is where
   *  that gets said — a progress line along its bottom rule — because it is
   *  the one part of the table that is not being replaced. */
  refreshing: boolean;
  /**
   * The filter row, already rendered by the `filterRow` slot, when any column
   * has a `filter`. Handed to the header so it can sit inside the header's own
   * sticky box: the two stick as one, and nothing has to know how tall the
   * header is to put the filter row under it.
   */
  filterRow?: ReactNode;
}

/**
 * The filter row: one cell per column, holding `column.filter`. One slot rather
 * than a row slot plus a cell slot, like `tfoot` — its content comes entirely
 * from the columns, so all the engine hands over per cell is what the render
 * set cannot read off a column itself, which is the pins.
 */
export interface RenderFilterRowCtx<T> {
  /** Every column, in order; a column without a `filter` gets an empty cell. */
  columns: Column<T>[];
  /** The columns' tracks — see `RenderTheadCtx.gridTemplate`. */
  gridTemplate: string;
  /** The last column has empty frame after it — see `RenderThCtx.trailing`. */
  trailing?: boolean;
  /** Where each frozen column sticks — see `RowPins`. The filter row is inside
   *  the sheet that slides, so a frozen column's filter has to hold still with
   *  it or it walks out from under its own header. */
  pins: RowPins;
}

// The engine finds the accessory by it — the only way it can, since the
// render set built the cell.
/**
 * The attribute a skin puts on the element wrapping `column.headerAccessory`.
 * Alt+↓ on a focused header cell clicks the first control inside it.
 */
export const HEADER_ACCESSORY_ATTR = 'data-header-accessory';

/** A header cell's resize handle: where a drag starts, and where its widths
 *  go. Absent for a column with `resizable: false`. */
export interface RenderThResize {
  /** The column's width as the table knows it: dragged, else its numeric
   *  `width`, else 160. `useColumnResize` measures the cell instead when it
   *  can. */
  startWidth: number;
  /** The column's `minWidth`. */
  minWidth?: number;
  /** Sets the column's width, in pixels: call it as the drag moves. */
  onWidthChange: (px: number) => void;
  /**
   * Fits the column to its widest cell on screen, never below `minWidth`:
   * the double-click on the handle.
   *
   * Measured, not estimated: only the DOM knows how wide a long title
   * actually is in this font at this weight. Only the mounted rows are
   * measured, which is the honest answer for a virtualized table.
   */
  onAutoFit: () => void;
  /**
   * Report the width a drag is currently proposing, and `null` when it ends.
   *
   * The handle already reports the width through `onWidthChange`; this says
   * that a drag is HAPPENING, which is a different fact and belongs to
   * somebody else. The guideline runs the full height of the table and the
   * chip sits over the rows, and a header cell can draw neither — so the
   * engine takes the number and renders both, through `resizeGuide`.
   */
  onDragChange?: (width: number | null) => void;
}

/** What the `th` slot is handed for one column's header cell. */
export interface RenderThCtx<T> {
  /** The column. */
  column: Column<T>;
  /** Zero-based position of this column in `columns`. A render set needs it to
   *  treat the leading column differently from the rest (the design's wider
   *  edge gutter); `column.key` cannot answer "am I first?". */
  index: number;
  /** How this column sorts, and its place in the sort from 0; absent when it
   *  doesn't. */
  sort?: { direction: 'asc' | 'desc'; index: number };
  /** How many columns the table sorts by. A skin shows `sort.index` only
   *  past one. */
  totalSorts: number;
  /** Put it on the control that sorts: a click sorts by this column alone, a
   *  shift-click adds it to the sort. Does nothing on a column that isn't
   *  `sortable`. */
  onSortClick: (e: MouseEvent) => void;
  /** The resize handle's numbers; absent when the column isn't resizable. */
  resize?: RenderThResize;
  /** This header cell holds the grid's focus. The ring is the ADAPTER's to
   *  draw — the engine has no business owning a colour. */
  focused?: boolean;
  /** MUST be spread onto the header cell element. */
  focusProps: CellFocusProps;
  /** Set when `column.pinned` is. The skin applies `pin.shift` as
   *  `position: relative; left`; the engine supplies the arithmetic, never
   *  the CSS. */
  pin?: CellPin;
  /**
   * This is the last column, and the columns do not fill the frame.
   *
   * The grid rules BETWEEN columns, as a left-hand border on every cell but
   * the first — which is the only shape a cell can decide on its own, since it
   * is told its index and never the column count. That leaves the last
   * column's right-hand edge unruled, and when the columns are narrower than
   * the table there is empty frame past it: the header still draws a line
   * there (its resize grip) and the rows below it draw nothing, so the column
   * visibly stops being a column halfway down.
   *
   * The engine answers the question the cell cannot — "am I last, and is there
   * anything after me?" — and only then. When the columns do fill the frame
   * this stays unset, because that edge already has the frame's own border on
   * it and two hairlines a pixel apart is a thicker line, not a tidier one.
   */
  trailing?: boolean;
  /** Content to render INSTEAD of `column.header`, when the engine owns what
   *  goes in the header cell. Today that means one thing: the select-all
   *  checkbox above a `select` column. Mirrors `RenderTdCtx.children`. */
  children?: ReactNode;
}

/** What the `tbody` slot is handed: the element that holds the rows, with the
 *  ref and the padding that place the mounted ones. */
export interface RenderTbodyCtx {
  /** The mounted rows and group bands, in order. */
  children: ReactNode;
  /**
   * MUST be attached to the element that holds the rows.
   *
   * The virtualizer rides the page's scroll position, so it has to be told
   * where the rows begin inside the page — the height of the page above the
   * table plus the header is not something the engine can compute, only
   * measure. This is the element it measures.
   */
  ref: (el: HTMLElement | null) => void;
  /** Scroll height of every row, mounted or not. Informational — the rowgroup
   *  no longer sets this as an explicit height, because the padding in `style`
   *  plus the mounted rows already add up to exactly it. */
  totalSize: number;
  /** The virtualization padding: how much row there is above the mounted
   *  window, and how much below. MUST be applied, or every mounted row sits at
   *  the top of the scroll region no matter where the table is scrolled. */
  style: CSSProperties;
}

/** What the `tr` slot is handed for one data row. */
export interface RenderTrCtx<T> {
  /** The row. */
  row: T;
  /** Its place among the rows on screen, from 0, counted across groups. */
  index: number;
  /**
   * This row's `aria-rowindex`: 1-based, counting the rows above the data —
   * the column header, and the filter row when there is one. The engine's
   * because only it knows how many header rows there are; `index + 2` stops
   * being true the moment a filter row appears.
   */
  ariaRowIndex: number;
  /** The row's cells, one `td` slot per column. */
  cells: ReactNode;
  /** The columns' tracks — see `RenderTheadCtx.gridTemplate`. */
  gridTemplate: string;
  /** The row's height. MUST be applied — the virtualizer sized the scroll
   *  region on the assumption this row is exactly this tall, so a row that
   *  ignores it puts every row after it at the wrong offset.
   *
   *  Height ALONE. Rows are in normal flow, so their stacking is document
   *  order and the mounted window's offset is the rowgroup's padding. This
   *  used to carry `position: absolute` and a `translateY`, which is the only
   *  reason a render set ever had to undo a stretched box with `right: auto`
   *  and `width: 100%`. It no longer should. */
  style: CSSProperties;
  /** The table's `onRowClick` for this row; absent without one. */
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
  /** This row's values are stale: a refresh is in flight over rows that are
   *  already on screen. They stay exactly where they are and read back a step,
   *  so a number you are looking at cannot be mistaken for a fresh one. */
  dimmed?: boolean;
}

/**
 * The selection checkbox, in a row or above the column. The engine knows what
 * is selected; the render set knows what a checkbox looks like, and that is
 * the whole division here.
 */
export interface RenderSelectCellCtx {
  /** In a row, the row is selected; in the header, every row is. */
  checked: boolean;
  /** Header only: some rows are selected but not all. */
  indeterminate?: boolean;
  /** True for the select-all cell in the column header. */
  isHeader: boolean;
  /** Call it when the box is clicked, with the click's `shiftKey`: a
   *  shift-click in a row adds every row between it and the last row ticked
   *  without shift. */
  onChange: (shiftKey: boolean) => void;
  /** Accessible name. A checkbox column shows no visible label, so a render
   *  set MUST attach this or every checkbox in the table is anonymous. */
  label: string;
}

/** A data row's height in pixels when the table is given no `rowHeight`. */
export const ROW_HEIGHT = 40;

/** What the `td` slot is handed for one cell. */
export interface RenderTdCtx<T> {
  /** The cell's column. */
  column: Column<T>;
  /** Zero-based column position, matching `RenderThCtx.index` — a cell has to
   *  reach the same gutter decision its header did or the two fall out of
   *  alignment. */
  index: number;
  /** The cell's row. */
  row: T;
  /** The content: `column.render(row)`, else `column.as({ value, row })`, else
   *  `column.value(row)` as text; the checkbox in a `select` column. */
  children: ReactNode;
  /** This cell holds the grid's focus. The ring is the ADAPTER's to draw. */
  focused?: boolean;
  /** MUST be spread onto the cell element. */
  focusProps: CellFocusProps;
  /** Set when `column.pinned` is — see `RenderThCtx.pin`. */
  pin?: CellPin;
  /** This is the last column AND the table does not fill its frame — see
   *  `RenderThCtx.trailing`. */
  trailing?: boolean;
  /** Set for a moment after Ctrl+C copied this cell, to say how it went. Only
   *  a skin with `onCopyCell` is told, since only it says whether the copy
   *  worked; what that looks like is the skin's to draw. */
  copy?: CellCopy;
}

/** How a cell's copy went: `copied`, or `failed` when the clipboard refused. */
export type CellCopy = 'copied' | 'failed';

/**
 * Every pin in one row, keyed by `Column.key`.
 *
 * The two row-shaped slots that draw their own cells — the loading skeleton
 * and the totals row — are handed the whole map rather than one `CellPin`,
 * because the engine makes no per-cell call there to hang one on. It is the
 * same map `RenderThCtx.pin` and `RenderTdCtx.pin` are dealt single entries
 * of, so a frozen column either holds still in all four of the table's row
 * shapes or in none of them.
 *
 * Empty rather than absent when nothing is pinned: a slot that has to ask
 * about every column it draws should not first have to ask whether it may ask.
 */
export type RowPins = ReadonlyMap<string, CellPin>;

/** What the `skeletonRow` slot is handed: one placeholder row, drawn ten
 *  times while the table loads with no rows. */
export interface RenderSkeletonRowCtx<T> {
  /** Every column, in order: a placeholder cell for each. */
  columns: Column<T>[];
  /** The columns' tracks — see `RenderTheadCtx.gridTemplate`. */
  gridTemplate: string;
  /** The last column has empty frame after it — see `RenderThCtx.trailing`. */
  trailing?: boolean;
  /** The caller's data row height, so a placeholder is the same height as the
   *  real rows it stands in for (e.g. a compact density's 32px rather than
   *  the engine's ROW_HEIGHT default). */
  rowHeight: number;
  /** Where each frozen column sticks — see `RowPins`. A skeleton lays out on
   *  the same tracks as the rows it stands in for, so a table scrolled
   *  sideways while it loads has to show the frozen columns where the real
   *  rows will put them. */
  pins: RowPins;
}

/** What the `error` slot is handed: drawn as the table's body, under the
 *  header, while the table has an `error`. */
export interface RenderErrorCtx {
  /** The table's `error`. */
  error: Error;
  /** The state's one action, present only when the caller supplied `onRetry`.
   *  A render set draws no button without it rather than inventing one that
   *  does nothing. */
  onRetry?: () => void;
}

// One slot rather than a row slot plus a cell slot: its content comes entirely
// from `column.footer`, so the only thing the engine has to hand over per cell
// is what the render set cannot read off the column itself — which is `pins`,
// and nothing else.
/** What the `tfoot` slot is handed: the totals row, a cell per column holding
 *  its `footer`, pinned to the bottom while there are rows. */
export interface RenderTfootCtx<T> {
  /** Every column, in order; one without a `footer` gets an empty cell. */
  columns: Column<T>[];
  /** The columns' tracks — see `RenderTheadCtx.gridTemplate`. */
  gridTemplate: string;
  /** The last column has empty frame after it — see `RenderThCtx.trailing`. */
  trailing?: boolean;
  /**
   * Where each frozen column sticks — see `RowPins`.
   *
   * The whole point of a total is that it sits under the column it totals, and
   * this row is inside the sheet that slides. Without the pins its "412 items"
   * walked out from under a frozen Name column the moment the table scrolled
   * sideways, and its cells painted across columns they had nothing to do
   * with.
   */
  pins: RowPins;
  /**
   * How far above the bottom of the viewport the totals row must pin, in
   * pixels: the height of the scrollbar and status bar docked below it.
   *
   * The totals row is inside the table's clip box and the dock is outside it,
   * so "sit just above the dock" is not something CSS can express from in
   * there — `bottom: 0` would put the totals row underneath it.
   */
  bottomOffset: number;
}

/** What the `empty` slot is handed: drawn as the table's body, under the
 *  header, when there are no rows, no error and nothing loading. */
export interface RenderEmptyCtx {
  /** Why the table is empty. "Nothing here yet" and "your filters hide
   *  everything" need different copy and different actions, and only the
   *  caller knows which applies — the engine is handed rows, not a query. */
  filtered: boolean;
  /** Clears whatever `filtered` is about. Only ever meaningful alongside it,
   *  and only present when the caller supplied `onClearFilters` — the engine
   *  never sees the query, so it cannot clear one. */
  onClearFilters?: () => void;
}

/**
 * A skin: a function per part of the table, each handed what to draw.
 * `<Table>` calls them, and draws only the plain boxes they sit in: the
 * frame, the box that clips the columns, and the dock at the foot. `@bh/ui`'s
 * skin is `tableRender()`.
 */
export interface TableRender<T = unknown> {
  /** The element around the whole table: `role="grid"`. */
  root: (ctx: RenderRootCtx) => ReactNode;
  /** The header row, around its cells. */
  thead: (ctx: RenderTheadCtx) => ReactNode;
  /** One header cell. */
  th: (ctx: RenderThCtx<T>) => ReactNode;
  /** The element that holds the rows. */
  tbody: (ctx: RenderTbodyCtx) => ReactNode;
  /** One data row, around its cells. */
  tr: (ctx: RenderTrCtx<T>) => ReactNode;
  /** One cell. */
  td: (ctx: RenderTdCtx<T>) => ReactNode;
  /** A group's band, and its pinned copy with `stickyGroupHeader`. */
  groupHeader: (ctx: RenderGroupHeaderCtx) => ReactNode;
  /** A placeholder row while the table loads with no rows. */
  skeletonRow: (ctx: RenderSkeletonRowCtx<T>) => ReactNode;
  /** The body while the table has an `error`. */
  error: (ctx: RenderErrorCtx) => ReactNode;
  /** The body when there are no rows. */
  empty: (ctx: RenderEmptyCtx) => ReactNode;
  /** The totals row, when a column has a `footer`. */
  tfoot: (ctx: RenderTfootCtx<T>) => ReactNode;
  /** Optional: a render set without it simply draws no filter row, and a
   *  column's `filter` is ignored — the same trade as `selectCell`. */
  filterRow?: (ctx: RenderFilterRowCtx<T>) => ReactNode;
  /** Optional: a render set that does not draw checkboxes simply cannot host
   *  a `select` column, rather than every existing render set breaking. */
  selectCell?: (ctx: RenderSelectCellCtx) => ReactNode;
  /**
   * The bar across the bottom of the table: how many rows, what is selected,
   * whatever the caller wants said about the page it is showing.
   *
   * Optional, and a table without it simply has no bar — it is chrome, not
   * structure.
   */
  statusBar?: (ctx: RenderStatusBarCtx) => ReactNode;
  /**
   * Classes for the FRAME, given how far the table is scrolled sideways.
   *
   * A className rather than a node, because this is one of the three elements
   * the engine cannot hand over: it is the box whose height the table fills,
   * and it carries the measurement ref. But the engine has no business
   * choosing what a border or a scroll edge looks like, so the render set
   * names the classes and the engine only says when.
   *
   * It was `scrollClass` while the frame and the scroll container were the
   * same element. They are not any more: the page scrolls, and the frame is
   * simply the table's edge.
   */
  frameClass?: (ctx: { scrollX: ScrollX }) => string;
  /**
   * The docked horizontal scrollbar — drawn, not native.
   *
   * Rendered only while the table is wider than its frame. The engine works
   * out the geometry and owns the drag, because both are arithmetic against a
   * scroll offset only it knows; the render set decides what a track and a
   * thumb look like, and when they are worth seeing.
   */
  hbar?: (ctx: RenderHbarCtx) => ReactNode;
  /**
   * The line and the width chip shown while a column is being resized.
   *
   * Rendered once, over the whole table, rather than by the header cell being
   * dragged: the point of the guideline is that it crosses every row, and a
   * cell 40px tall cannot draw over the thousand pixels below it.
   */
  resizeGuide?: (ctx: RenderResizeGuideCtx) => ReactNode;
  /**
   * The soft edge where content passes out of sight: beside a frozen column,
   * and at whichever side of the frame is hiding columns.
   *
   * Called once per visible edge. The engine says WHERE one belongs and how
   * tall it is; what a fade looks like is the render set's.
   */
  scrim?: (ctx: RenderScrimCtx) => ReactNode;
  /**
   * Writes a cell's text to the clipboard when Ctrl+C (Cmd+C) copies the
   * focused cell, and resolves to whether it did. The table then hands that
   * cell `RenderTdCtx.copy` for a moment, so `td` can show it worked, or
   * that it failed.
   *
   * Optional: without it the table writes with `navigator.clipboard` itself,
   * and shows nothing either way, since it cannot draw.
   */
  onCopyCell?: (text: string) => Promise<boolean>;
}

/** What the `resizeGuide` slot is handed while a column is dragged: drawn
 *  once, over the whole table. */
export interface RenderResizeGuideCtx {
  /** Pixels from the table's left edge to the column's projected new edge,
   *  in the sheet's own coordinates — so it stays put as the table slides. */
  left: number;
  /** The width the column would take if the drag ended now. */
  width: number;
  /** How much that is bigger (+) or smaller (−) than the width it started at. */
  delta: number;
}

/** What the `scrim` slot is handed, once per edge where columns pass out of
 *  sight: beside the frozen columns, or at a side of the frame. */
export interface RenderScrimCtx {
  /**
   * Which edge this is.
   *
   * `freeze` is the boundary the frozen columns hold, and appears only once
   * the table has actually slid under them. `start` and `end` are the frame's
   * own edges, and appear when there are columns hidden past them.
   */
  kind: 'freeze' | 'start' | 'end';
  /** Pixels from the frame's left edge (`freeze`, `start`) or its right edge
   *  (`end`). */
  offset: number;
  /** Pixels of the frame's bottom already spoken for by the scrollbar and the
   *  status bar, so the fade stops above them rather than running over. */
  bottom: number;
}

/** What the `hbar` slot is handed: the horizontal scrollbar docked at the
 *  table's foot, drawn while the columns are wider than the frame. */
export interface RenderHbarCtx {
  /** Thumb width in pixels — the visible fraction of the table, floored so it
   *  stays grabbable on a very wide one. */
  thumbWidth: number;
  /** How far along the track the thumb sits, in pixels from its left edge. */
  thumbOffset: number;
  /** True while the thumb is being dragged. */
  dragging: boolean;
  /**
   * Whether the bar is worth showing at all right now.
   *
   * A scrollbar that is always there is one more line across every table; one
   * that is never there cannot be found. So it appears while the pointer is
   * over the table, while the table is moving sideways, and while it is being
   * dragged — and fades back out when none of those is true.
   */
  visible: boolean;
  /** Spread onto the thumb. */
  thumbProps: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => void;
  };
  /** Spread onto the track, for click-to-jump. */
  trackProps: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  };
}

/** What the `statusBar` slot is handed: the bar docked under the table. */
export interface RenderStatusBarCtx {
  /** Rows the table is holding — which is not the same as rows that exist on
   *  a server. Anything the engine cannot know goes in `status`. */
  rowCount: number;
  /** How many rows are selected. */
  selectedCount: number;
  /** The table's sort. */
  sort: SortBy[];
  /** Whatever the caller passed as `status`: a page number, a server total, a
   *  last-refreshed time. Rendered as given. */
  status?: ReactNode;
}

/** A group band's height in pixels. A skin draws its bands this tall: the
 *  virtualizer places every row below the first band by it. */
export const GROUP_ROW_HEIGHT = 34;

/** A band of rows under a header of its own, which `<Table groups>` draws in
 *  order. */
export interface TableGroup<T> {
  /** Names the group in `TableState.collapsed`. Unique within the table. */
  key: string;
  /** What the band says: a label, a count. */
  header: ReactNode;
  /** The group's rows, in the order drawn. */
  rows: T[];
}

// Group headers and data rows share a single virtualizer so the table keeps
// one scroll region.
/** One entry in the list `flattenGroups` makes: a group's band, or a row and
 *  its index among the rows on screen. */
export type VirtualRow<T> =
  { kind: 'group'; key: string; header: ReactNode } | { kind: 'row'; row: T; index: number };

/** What the `groupHeader` slot is handed for one group's band. */
export interface RenderGroupHeaderCtx {
  /** The group's `key`. */
  key: string;
  /** The group's `header`. */
  header: ReactNode;
  /** The columns' tracks — see `RenderTheadCtx.gridTemplate`. A band may span
   *  them rather than lay out on them. */
  gridTemplate: string;
  /** The band's height — see `RenderTrCtx.style`. Empty for the sticky copy,
   *  which is not in the virtual list. */
  style: CSSProperties;
  /** Whether this group's rows are hidden. */
  collapsed: boolean;
  /** True for the extra copy pinned under the column header. The real band
   *  leaves the DOM once it scrolls out of the virtual window, so the pinned
   *  band is a second rendering, and `style` is empty for it. The render set
   *  decides where it sticks and what it looks like. */
  sticky?: boolean;
  /** The table has a filter row, so the sticky copy has to land under it
   *  rather than directly under the column header. */
  belowFilterRow?: boolean;
  /** Absent when the caller supplies no `onCollapseChange` — collapsing is
   *  opt-in, like focus and selection, so a band that cannot collapse must not
   *  render a disclosure control that does nothing. */
  onToggle?: () => void;
}
