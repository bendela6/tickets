# Table Component — Final Design

Three layers, composed rather than inherited: a dumb renderer that knows nothing about data, a data
layer that owns fetching and chunked loading, and the screen that supplies domain knowledge.

Layer 1 already exists — `@tickets/table` (676 LOC) plus its styled adapter in
`@tickets/ui/src/table/` (566 LOC), landed 2026-07-29. **The mission is layer 2**, plus the small
set of additions layer 1 needs before layer 2 can sit on top of it.

## Decisions (locked with user)

1. **Two or more layers, each building on the one below.** The base table stays dumb and generic;
   the data table knows how to feed it, interpret what it asks for (sort, filter, visible range),
   and load data in chunks because a source may hold millions of records.
2. **The base table is not the mission.** It is built. It gains three hooks and a handful of slots,
   nothing more.
3. **Focus is per CELL, not per row.** A user must be able to focus one specific cell. This is what
   makes copy, range selection and inline editing tractable later; row-level focus makes all three
   impossible.
4. **Composition, not inheritance.** `DataTable` renders `Table` and passes props. The governing
   rule: *`Table` must never gain a prop that exists only to serve `DataTable`.* The three data
   hooks below pass that test — a static caller can use all of them.

## Layer topology

```
┌──────────────────────────────────────────────────────┐
│ Screen  (all-items, board, gallery)                  │
│   owns: columns, cell renderers, domain mapping      │
└───────────────┬──────────────────────────────────────┘
                │  Column<T>[] + TableRender<T>
┌───────────────▼──────────────────────────────────────┐
│ DataTable  @tickets/table/data              ← BUILD  │
│   owns: fetching, chunk cache, sort/filter state,    │
│         invalidation, abort, retry, total count      │
└───────────────┬──────────────────────────────────────┘
                │  rowCount + getRow(i) + onRangeChange
┌───────────────▼──────────────────────────────────────┐
│ Table  @tickets/table                       ← EXISTS │
│   owns: virtualization, CSS-Grid layout, resize,     │
│         sort INTENT, cell focus, selection, ARIA     │
└───────────────┬──────────────────────────────────────┘
                │  11 render slots
┌───────────────▼──────────────────────────────────────┐
│ tableRender()  @tickets/ui/src/table                 │
│   owns: every class name — metrics.ts, tokens        │
└──────────────────────────────────────────────────────┘
```

| Layer | Owns | Must not know |
| --- | --- | --- |
| `Table` | virtualization, grid layout, resize, sort intent, focus, selection, ARIA | where rows come from |
| `DataTable` | fetching, chunking, cache, invalidation, sort/filter state | what a ticket is |
| Screen | columns, cell renderers, domain mapping | how paging works |

## What layer 1 is missing

`Table` takes `rows: T[]` — a fully materialized array — and derives the virtualizer's `count` from
`items.length`. A million records cannot go through that. Three additive props fix it, and none of
them knows about HTTP, caching or sort semantics:

```ts
rowCount?: number
// Total rows in the source. Sizes the scrollbar independently of what is loaded.

getRow?: (index: number) => T | undefined
// Sparse access. `undefined` means "not fetched yet" and renders a skeleton at that index,
// replacing today's all-or-nothing `isLoading && items.length === 0` branch.

onRangeChange?: (range: { startIndex: number; endIndex: number }) => void
// The virtualizer already computes this internally and tells nobody. Without it the data layer
// cannot know what to fetch. This is the load-bearing hook.
```

**One thing is already right.** The engine is headless on sort: it emits intent through
`onSortChange` and never reorders rows itself. That looked like an omission when it was built; it
is exactly what makes server-side sorting work without fighting the component.

## Cell focus model

### Mechanism

Virtualization forces the choice between the two standard approaches:

| | Roving `tabindex` | `aria-activedescendant` |
| --- | --- | --- |
| Real DOM focus on the cell | yes | no — stays on the container |
| Survives the row being virtualized away | no — node unmounts, focus falls to `<body>` | yes |
| Nested widgets (`StatusSelect`) | natural | must move real focus in anyway |
| Screen-reader support for grids | best | patchier |

**Chosen: roving `tabindex`**, with two mitigations for the unmount problem:

1. Keyboard movement scrolls the target into view *before* focusing it, so a cell can never be
   focused and unmounted in the same frame.
2. If the user mouse-scrolls the focused row away, DOM focus moves to the scroll container while the
   logical `CellRef` is retained; real focus is restored when the row remounts or on the next key.

### Two modes

Cells in this codebase already contain interactive widgets — `StatusCell` renders a radix dropdown,
`ActionsColumn` renders buttons, `LinkColumn` renders anchors. Arrow keys cannot mean both "move to
the next cell" and "move within the dropdown", so the grid runs the standard ARIA two-mode pattern:

- **Navigation mode** (default) — the grid is **one tab stop**. The focused cell carries
  `tabindex="0"`; every other cell, and every widget inside any cell, carries `tabindex="-1"`.
  Arrows move between cells.
- **Interaction mode** — `Enter` or `F2` moves real focus into the cell's first focusable child.
  Arrows then belong to that widget. `Escape` returns focus to the cell.

**`Tab` must leave the grid entirely.** With 10 columns over 1,000 rows, making every cell a tab
stop turns the table into a keyboard trap. A single tab stop is the ARIA grid contract.

### Keyboard map

| Key | Navigation mode |
| --- | --- |
| `↑ ↓ ← →` | move one cell; hidden columns are skipped |
| `Home` / `End` | first / last cell in the row |
| `Ctrl+Home` / `Ctrl+End` | first / last cell in the table |
| `PageUp` / `PageDown` | one viewport |
| `↑` from row 0 | the header row, so sorting is keyboard-reachable |
| `Enter` / `F2` | enter interaction mode; if the cell holds no widget, activate the row |
| `Escape` | leave interaction mode |
| `Space` | select the row (or peek — see `docs/design/03-project-board.html:146`) |
| `Shift+↑↓←→` | extend a cell range (phase 8) |
| `Ctrl/Cmd+C` | copy the focused cell or range |
| `Tab` | leave the grid |

### Two deliberate asymmetries in `CellRef`

- **Column *key*, not index** — focus survives hiding, reordering and pinning.
- **Row *index*, not id** — focus is positional, and under windowed loading the row at that index
  may not be fetched yet. Changing sort resets the window anyway, so index stability is moot.
- **`rowIndex: -1` addresses the header row**, which is what makes `↑` from row 0 reach the column
  headers rather than dead-ending.

### Focus ring

The house idiom is `focus-visible:ring-3`, which is **wrong for cells** — a 3px soft ring bleeds
over the neighbouring cell in a dense grid. `tokens.css:1094` already establishes the correct shape
for a rectangular selection (rich-text node selection):

```css
outline: 2px solid var(--color-indigo-9);
outline-offset: 1px;
```

Cells use the same colour at `outline-offset: -2px` so the ring sits **inset** and cannot overlap an
adjacent cell or the row border. The ring lives entirely in the adapter: the `td` and `th` slots
each receive `focused: boolean`.

## DataTable

### Two invariants

Both become non-negotiable the moment data is windowed:

1. **Sorting and filtering are server-side only.** A client-side filter over a partial window sees
   only loaded chunks and returns silently wrong results.
2. **Keyset pagination, not offset.** With `offset`/`limit`, a row inserted between two fetches
   shifts every later chunk — duplicated and skipped rows, with no error. Tickets are created while
   people browse, so this is a live failure mode, not a theoretical one.

### Responsibilities

`DataTable` owns the chunk cache keyed by `source.key`, in-flight request dedupe, abort on
sort/filter change, the total count, and per-chunk retry. It maps `onRangeChange` to fetches,
debounced so that dragging the scrollbar across 800,000 rows issues one request rather than
hundreds.

### What blocks it

`/api/projects/:key/board` returns **the entire board** — no `limit`, no `offset`, no sort, no
filter. There is nothing for a chunked `DataTable` to talk to. The only paged endpoint in the API is
`/api/items/:id/events`, which does establish the house envelope worth reusing:

```ts
{ data: rows, meta: { skip, take, total, sort } }
```

So the first phase of the mission is backend work.

## Feature list

Legend: **✅** built · **🔩** built but unwired or unverified · **🆕** to build · **⛔** decided against

| Area | Feature | |
| --- | --- | --- |
| Rendering | Row virtualization (`@tanstack/react-virtual`) | ✅ |
| | CSS Grid track widths — `minmax()`, `1fr` | ✅ |
| | Custom cell renderers + 7 column helpers | ✅ |
| | Render-slot injection — zero styling in the engine | ✅ |
| | Design-token metrics in one module (`metrics.ts`) | ✅ |
| | `empty` slot | 🆕 |
| | `rowOverlay` slot | 🆕 |
| | Per-row height — `getRowHeight(row, i)` | 🆕 |
| | Density as a token rather than a raw number | 🆕 |
| | Column virtualization | ⛔ pays off past ~50 columns; we render 8–10 |
| Columns | Resize + `localStorage` width persistence | 🔩 |
| | Sortable flag, `aria-sort`, caret, multi-sort ordinals | ✅ |
| | Pinning / sticky leading column | 🆕 |
| | Auto-fit on resize-handle double-click | 🆕 |
| | Header overflow menu — sort / hide / pin | 🆕 |
| | Drag reorder | ⛔ |
| | Header groups (spanning) | ⛔ |
| Sorting | Sort intent, asc → desc → none | ✅ |
| | Multi-sort via shift-click | 🔩 renders ordinals nothing consumes |
| | Built-in `sortRows` default with opt-out | 🆕 |
| Interaction | Row click | ✅ |
| | **Cell focus model** (roving tabindex, two modes) | 🆕 |
| | Keyboard navigation | 🆕 |
| | Row selection — `selectedKeys`, checkbox column, shift-range | 🆕 |
| | Cell range selection | 🆕 open decision |
| | Copy focused cell / range | 🆕 |
| Grouping | Single-level, caller-supplied bands | ✅ |
| | Continuous row indices across groups | ✅ |
| | Collapsible groups | 🆕 |
| | Sticky group headers | 🆕 |
| | Footer / totals row | 🆕 |
| | Lazy server-side groups | 🆕 |
| States | Skeleton rows | ✅ |
| | Error slot | ✅ |
| | Per-row skeleton for unloaded indices | 🆕 |
| Data layer | `rowCount` + `getRow(i)` + `onRangeChange` | 🆕 |
| | Chunk cache + eviction | 🆕 |
| | Window invalidation on sort/filter change | 🆕 |
| | Abort in-flight requests on change | 🆕 |
| | Per-chunk retry | 🆕 |
| | Keyset pagination | 🆕 |
| | Selection surviving chunk eviction | 🆕 |
| | Cache patching after an edit | 🆕 |
| A11y | `grid` / `row` / `columnheader` / `cell` roles | ✅ |
| | `aria-sort` | ✅ |
| | `role="cell"` → `gridcell` | 🆕 |
| | axe coverage in the gallery | 🆕 |
| Quality | 42 engine + 35 adapter tests | ✅ |
| | Virtualization guard — 10k rows, bounded mount count | 🆕 |
| | Visual regression snapshots | 🆕 |
| | Gallery demos for all 7 column helpers | 🔩 4 of 7 |

## Sequencing

| Phase | Work | Effort | |
| --- | --- | --- | --- |
| 0 | Close API holes: `empty` + `rowOverlay` slots, density token, multi-sort decision | 1d | ✅ `8e84d88` |
| 1 | Lock down: virtualization guard, axe, 3 missing demos, visual baseline | 2d | ⚠️ `25a82c7` — visual baseline NOT done |
| 2 | `sortRows` default + `useTable()` uncontrolled state | 1d | ✅ `885d858` |
| 3 | **Cell focus model** → keyboard navigation | 2–3d | ✅ `233ccbf` |
| 4 | Row selection (builds on focus for the range anchor) | 1–2d | ✅ `8501cda` |
| 5 | Pinning, scroll shadow, auto-fit, per-row height | 2d | ✅ `1a8f940` |
| 6 | **Backend**: keyset-paged, sorted, filtered items endpoint | 2–3d |
| 7 | Base windowing: `rowCount` + `getRow` + `onRangeChange` + per-row skeleton | 1–2d |
| 8 | **DataTable v1** — flat, server sort/filter, cache, invalidation, abort, retry | 3–4d |
| 9 | Selection across chunks, cache patching, cell ranges, lazy groups | 5d |

Phases 0–5 complete layer 1 (~9 days). Phases 6–8 are the mission (~7 days). Phase 6 is backend and
cannot be skipped.

## Where the build departed from this sketch

Phases 0–5 shipped. Five things resolved differently from what is written above,
and the code is right in each case:

1. **Multi-sort was kept, not dropped.** Phase 2's `sortRows` honours the full
   `SortBy[]`, so the shift-click affordance the engine already rendered became
   real rather than being deleted one phase before it worked.
2. **`TableState.editing` does not exist.** Interaction mode is engine-local
   state. This page listed the field but defined no `onEditingChange`, so a
   controlled `editing` would have been a prop nothing could ever move.
3. **`role="cell"` stays.** Real axe over every gallery demo state did not flag
   it under `role="grid"`. Open decision 3 below is therefore closed. Axe *did*
   find two CRITICAL `aria-required-children` violations — the group band and
   the row overlay each put bare content inside a `role="row"` — both since
   fixed.
4. **The scroll and pinned "shadows" are hairlines.** A one-sided inset shadow
   needs an arbitrary Tailwind value, which this project forbids, and every
   `shadow-*` token casts on all four sides — on a 32px row that reads as a
   smudge. `SCROLL_EDGE` and `PINNED_EDGE` in `metrics.ts`; a one-line swap if a
   token is ever added.
5. **Sorting puts missing values last in BOTH directions** — the one deliberate
   asc/desc asymmetry. `NaN` counts as missing; empty string does not.

Two capabilities are opt-in by construction, so existing tables are unaffected:
the focus model activates only when `onFocusChange` is supplied (otherwise the
engine never touches the tab order, and links inside cells stay tabbable), and
selection only when `getRowId` *and* `onSelectionChange` are both present.

## Open decisions

1. **Cell range selection, or row selection only?** Ranges (shift+arrows, spreadsheet-style) are the
   main thing AG Grid charges for, and are only worth building if people will copy blocks of cells
   out of this table. Row selection alone is materially cheaper and covers bulk actions.
2. **Is chunking for real scale or for headroom?** If the largest realistic project is ~50k tickets,
   the base table already virtualizes that in memory and phases 6–8 buy complexity rather than
   speed. The stronger argument here is server-side: `buildBoard` serializing an entire board is the
   cost that actually hurts.
3. **`role="cell"` → `gridcell`** — do it after the axe run reports whether it matters.

## Out of scope

Column virtualization, drag column reorder, spanning header groups, pivot, tree data, master/detail,
Excel export, and a mobile card render mode. The last one is real spec debt
(`docs/design/02-all-tickets.html:304`) but belongs to the screen, not the component.

## Types

Everything named above, defined here. `✳` marks what does not exist yet.

```ts
import type { CSSProperties, MouseEvent, ReactNode } from 'react';

// ---------------------------------------------------------------- base table

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
  as?: Renderer<any>;
  sortable?: boolean;
  resizable?: boolean;
  /** A number is pixels. A string is emitted into grid-template-columns verbatim,
   *  so `minmax(240px, 1fr)` and other track functions work. A dragged width wins. */
  width?: number | string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  pinned?: 'left' | 'right'; // ✳
}

export interface TableGroup<T> {
  key: string;
  header: ReactNode;
  rows: T[];
}

export type VirtualRow<T> =
  | { kind: 'group'; key: string; header: ReactNode }
  | { kind: 'row'; row: T; index: number };

/** ✳ `rowIndex: -1` addresses the header row. */
export interface CellRef {
  rowIndex: number;
  columnKey: string;
}

export interface TableState {
  sort: SortBy[];
  widths: Record<string, number>;
  /** Carried by useTable(); the engine does not act on it yet — collapsible
   *  groups are not in phases 0–5. */
  collapsed?: Set<string>;
  focused?: CellRef | null;
  selected?: Set<string>;
}

/** Sticky geometry for a pinned cell. The ENGINE computes it: only it sees
 *  column order together with dragged widths. `edge` marks the innermost
 *  pinned column per side, so three frozen columns draw one divider. */
export interface CellPin {
  side: 'left' | 'right';
  offset: number;
  edge: boolean;
}

/** How far the scroll container is scrolled horizontally, so the adapter can
 *  mark which edges have content hidden past them. */
export type ScrollX = 'none' | 'start' | 'middle' | 'end';

/** Spread onto a cell so the engine can find it again. Focus moves by ADDRESS,
 *  not by ref — a ref goes stale the moment a virtualized row unmounts. */
export interface CellFocusProps {
  tabIndex?: number;
  'data-cell-row': number;
  'data-cell-col': string;
}

export interface RenderSelectCellCtx {
  checked: boolean;
  indeterminate?: boolean;
  isHeader: boolean;
  onChange: (shiftKey: boolean) => void;
  label: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  getRowId: (row: T) => string; // ✳

  // data — one shape of three
  rows?: T[];
  groups?: TableGroup<T>[];
  rowCount?: number; // ✳
  getRow?: (index: number) => T | undefined; // ✳

  state: TableState;
  onSortChange: (next: SortBy[]) => void;
  onWidthChange: (key: string, px: number) => void;
  onCollapseChange?: (next: Set<string>) => void; // ✳
  onSelectionChange?: (next: Set<string>) => void; // ✳
  onFocusChange?: (next: CellRef | null) => void; // ✳
  onRangeChange?: (range: { startIndex: number; endIndex: number }) => void; // ✳

  onRowClick?: (row: T) => void;
  onRowActivate?: (row: T) => void; // ✳ Enter on a widget-less cell

  isLoading: boolean;
  error?: Error | null;
  rowHeight?: number | ((row: T | undefined, index: number) => number); // ✳ fn form
  render: TableRender<T>;
}

// ---------------------------------------------------------------- render slots

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
  index: number;
  sort?: { direction: 'asc' | 'desc'; index: number };
  totalSorts: number;
  onSortClick: (e: MouseEvent) => void;
  resize?: RenderThResize;
  focused?: boolean; // ✳
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
  selected?: boolean; // ✳
  overlay?: ReactNode; // ✳
}
export interface RenderTdCtx<T> {
  column: Column<T>;
  index: number;
  row: T;
  children: ReactNode;
  focused?: boolean; // ✳
}
export interface RenderGroupHeaderCtx {
  key: string;
  header: ReactNode;
  gridTemplate: string;
  style: CSSProperties;
  collapsed?: boolean; // ✳
  onToggle?: () => void; // ✳
}
export interface RenderSkeletonRowCtx<T> {
  columns: Column<T>[];
  gridTemplate: string;
  rowHeight: number;
}
export interface RenderErrorCtx {
  error: Error;
  onRetry?: () => void; // ✳
}
export interface RenderEmptyCtx {
  // ✳
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
  empty: (ctx: RenderEmptyCtx) => ReactNode; // ✳
}

// ---------------------------------------------------------------- data table ✳

export interface FilterRule {
  fieldKey: string;
  op: 'any-of' | 'none-of' | 'contains' | 'empty' | 'not-empty' | 'kinds';
  values: string[];
}

export interface FetchRequest {
  /** Keyset, not offset — an insert between fetches must not shift later chunks. */
  cursor: string | null;
  limit: number;
  sort: SortBy[];
  filters: FilterRule[];
  signal: AbortSignal;
}

export interface FetchResult<T> {
  rows: T[];
  total?: number;
  nextCursor?: string | null;
}

export interface DataSource<T> {
  /** Cache identity. Changing it resets the window. */
  key: unknown[];
  chunkSize?: number; // default 100
  fetch: (req: FetchRequest) => Promise<FetchResult<T>>;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  source: DataSource<T>;
  getRowId: (row: T) => string;
  /** Controlled — the screen owns the filter chips. */
  filters?: FilterRule[];
  initialSort?: SortBy[];
  render: TableRender<T>;
  onRowClick?: (row: T) => void;
}

// ---------------------------------------------------------------- helpers

/** ✳ Uncontrolled defaults for every field of TableState, with controlled
 *  props as the escape hatch. */
export declare function useTable<T>(opts?: {
  initialSort?: SortBy[];
  widthsId?: string;
}): {
  state: TableState;
  onSortChange: (next: SortBy[]) => void;
  onWidthChange: (key: string, px: number) => void;
  onCollapseChange: (next: Set<string>) => void;
  onSelectionChange: (next: Set<string>) => void;
  onFocusChange: (next: CellRef | null) => void;
};

/** ✳ The default comparator the engine currently makes every caller write. */
export declare function sortRows<T>(rows: T[], sort: SortBy[], columns: Column<T>[]): T[];

export declare const ROW_HEIGHT: number;
export declare const GROUP_ROW_HEIGHT: number;
```
