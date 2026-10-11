---
title: Overview
summary: Draw a sortable, resizable, virtualized table over an array of rows, in
  @bh/ui's look or one of your own.
order: 1
related: [Columns, useTable, Writing a skin]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

Draw a sortable, resizable, virtualized table over an array of rows, in
`@bh/ui`'s look or one of your own.

## Import

```tsx
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { tableRender } from '@bh/ui';
```

## A first table

A table is its columns, its rows, the state `useTable` holds, and a skin
to draw it. Click a header to sort by it, drag a column's edge to resize
it, or Tab into the table and move with the arrows. The widths you drag
are saved under `docs:files:widths`, from the key this example names, and
are back when you reload the page.

**Files**

```tsx
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { BadgeColumn, DateColumn, NumberColumn, TextColumn, tableRender, type Tone } from '@bh/ui';

interface File {
  id: string;
  name: string;
  kind: string;
  /** In kilobytes; none for a folder. */
  size: number | null;
  modified: string;
}

const FILES: File[] = [
  {
    id: '1',
    name: 'Garden plan.pdf',
    kind: 'document',
    size: 482,
    modified: '2026-09-28T09:12:00Z',
  },
  { id: '2', name: 'Holiday photos', kind: 'folder', size: null, modified: '2026-08-14T17:40:00Z' },
  { id: '3', name: 'Budget 2026.xlsx', kind: 'sheet', size: 96, modified: '2026-09-30T08:05:00Z' },
  { id: '4', name: 'Lisbon tram.jpg', kind: 'image', size: 3120, modified: '2026-07-02T11:20:00Z' },
  { id: '5', name: 'Recipes.docx', kind: 'document', size: 214, modified: '2026-06-19T19:02:00Z' },
  {
    id: '6',
    name: 'Backup 09-2026.zip',
    kind: 'archive',
    size: 58200,
    modified: '2026-09-01T02:00:00Z',
  },
  { id: '7', name: 'Reading list.md', kind: 'document', size: 6, modified: '2026-09-29T21:44:00Z' },
  {
    id: '8',
    name: 'Tbilisi old town.jpg',
    kind: 'image',
    size: 2870,
    modified: '2026-05-23T14:31:00Z',
  },
  { id: '9', name: 'Seed orders.xlsx', kind: 'sheet', size: 41, modified: '2026-03-11T10:15:00Z' },
  { id: '10', name: 'Scans', kind: 'folder', size: null, modified: '2026-09-12T16:00:00Z' },
  {
    id: '11',
    name: 'Bike receipt.pdf',
    kind: 'document',
    size: 133,
    modified: '2026-04-08T12:47:00Z',
  },
  { id: '12', name: 'Fonts.zip', kind: 'archive', size: 12400, modified: '2026-02-17T09:30:00Z' },
  {
    id: '13',
    name: 'Porto bridge.jpg',
    kind: 'image',
    size: 4410,
    modified: '2026-07-05T18:09:00Z',
  },
  {
    id: '14',
    name: 'Flat inventory.xlsx',
    kind: 'sheet',
    size: 28,
    modified: '2026-01-26T20:20:00Z',
  },
  { id: '15', name: 'Letters', kind: 'folder', size: null, modified: '2025-12-03T08:00:00Z' },
  {
    id: '16',
    name: 'Tax return 2025.pdf',
    kind: 'document',
    size: 905,
    modified: '2026-04-29T15:55:00Z',
  },
];

const KIND_TONE: Record<string, Tone> = {
  folder: 'gray',
  document: 'blue',
  sheet: 'green',
  image: 'purple',
  archive: 'orange',
};

const columns: Column<File>[] = [
  {
    key: 'name',
    header: 'Name',
    value: (file) => file.name,
    as: TextColumn(),
    sortable: true,
    width: 'minmax(220px, 1fr)',
  },
  {
    key: 'kind',
    header: 'Kind',
    value: (file) => file.kind,
    as: BadgeColumn<string>({ tone: (kind) => KIND_TONE[kind] ?? 'gray' }),
    sortable: true,
    width: 120,
  },
  {
    key: 'size',
    header: 'Size (KB)',
    value: (file) => file.size,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 120,
  },
  {
    key: 'modified',
    header: 'Modified',
    value: (file) => file.modified,
    as: DateColumn(),
    sortable: true,
    width: 150,
  },
];

export function Files() {
  // The app names the key its widths are saved under.
  const table = useTable({ storageKey: 'docs:files' });
  return (
    // The page scrolls a table, not the table itself: this box stands in for the page.
    <div className="h-360 w-full overflow-auto">
      <Table<File>
        {...table}
        columns={columns}
        rows={sortRows(FILES, table.state.sort, columns)}
        isLoading={false}
        render={tableRender<File>()}
      />
    </div>
  );
}
```

## The parts

1. **[Columns](columns.md)**: what each header says, how a cell is
   drawn from a row, and how the column sorts, sizes and sticks.
2. **[`useTable`](use-table.md)**: the sort, the widths, the
   collapsed groups, the focused cell and the selection, with a handler
   for each, spread onto `<Table>`.
3. **`<Table>`**: decides what to draw and when (the header, the rows on
   screen, a skeleton, an empty or failed state) and reports what the user
   asks for: a [sort](sorting.md), a
   [width](widths-and-resizing.md), a
   [selection](selection.md), a [focused cell](keyboard-focus.md).
4. **A skin**: a function for each part of the table. `@bh/ui`'s
   `tableRender()` draws them in its look, and its
   [cell renderers](cell-renderers.md) draw values: text, numbers,
   dates, badges, links. [Writing a skin](writing-a-skin.md) makes
   one of your own.

The table draws no cell, row or header itself, and never reorders the
rows it is given. A header click reports the sort through `onSortChange`,
and the page orders the rows: with `sortRows` in the browser, as here, or
by asking a server for them in that order.

## Where it scrolls

The table has no scroll box of its own. It is as tall as its rows, and
the nearest ancestor that scrolls (in an app, the shell's main area)
scrolls it: its header sticks to that ancestor's top, and only the rows
in view are drawn. The examples on these pages sit in a box of a fixed
height that stands in for the page. More on this in
[Virtualization and states](virtualization-and-states.md).

## Rules

- The table draws nothing of its own but a few plain boxes: the frame,
  the box that clips the columns, and the dock at its foot. Every header,
  row, cell, band and state comes from the skin.
- It never reorders, filters or fetches rows: it reports the sort, and
  draws the rows it is given in the order given.
- Keyboard focus and collapsing groups are on only when their handler is
  given, and selection when `getRowId` is given too. `useTable` gives all
  three handlers.
- The app names the key widths are saved under, and the table adds no
  prefix: `useTable({ storageKey: 'shop:orders' })` saves to
  `shop:orders:widths`. Without a key nothing is saved.

## Reference

| Prop                       | Type                                                         | Default | Description                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns` (required)       | `Column<T>[]`                                                |         | The columns, left to right.                                                                                                                                                                                                                                                       |
| `rows` (required)          | `T[]`                                                        |         | The rows, in the order drawn: the table never reorders them.                                                                                                                                                                                                                      |
| `groups`                   | `TableGroup<T>[]`                                            |         | Grouped rows. Mutually exclusive with `rows` in practice — when present it wins, and `rows` is ignored.                                                                                                                                                                           |
| `state` (required)         | `TableState`                                                 |         | The sort, the dragged widths, the collapsed groups, the focused cell and the selection. `useTable` holds one.                                                                                                                                                                     |
| `onSortChange` (required)  | `(next: SortBy[]) => void`                                   |         | Called with the next sort when a header is clicked.                                                                                                                                                                                                                               |
| `onWidthChange` (required) | `(key: string, px: number) => void`                          |         | Called with a column's key and its new width as a resize handle moves.                                                                                                                                                                                                            |
| `onCollapseChange`         | `(next: Set<string>) => void`                                |         | Supplying this is what turns group collapsing on: each band gets a disclosure control, and a collapsed group's rows leave the virtualized list entirely. Without it the bands render as plain headers.                                                                            |
| `onFocusChange`            | `(next: CellRef \| null) => void`                            |         | Supplying this is what turns the cell focus model ON: a roving tabindex over the cells, arrow-key navigation, and the grid as a single tab stop. Without it the engine does not touch the tab order, so a table whose cells hold links and buttons keeps them tabbable.           |
| `getRowId`                 | `(row: T) => string`                                         |         | Stable identity for a row. Required for selection, which is keyed on id rather than position — under sort, filter and windowed loading the row at index 4 is not the row it was a moment ago. Optional so that every table that does not select does not have to supply one.      |
| `onSelectionChange`        | `(next: Set<string>) => void`                                |         | Supplying this, together with `getRowId`, is what turns row selection on. `Space` toggles the focused row; the checkbox column and shift-click ranges do the rest.                                                                                                                |
| `onRowClick`               | `(row: T) => void`                                           |         | Called with the row when a row is clicked.                                                                                                                                                                                                                                        |
| `onRowActivate`            | `(row: T) => void`                                           |         | `Enter` on a focused cell that holds no widget of its own.                                                                                                                                                                                                                        |
| `isLoading` (required)     | `boolean`                                                    |         | The rows are loading. With no rows it draws ten skeleton rows; with rows it changes nothing.                                                                                                                                                                                      |
| `isRefreshing`             | `boolean`                                                    | `false` | A reload running over rows that are already on screen.                                                                                                                                                                                                                            |
| `error`                    | `Error \| null`                                              |         | A failed load. The `error` slot replaces the body, under the header, until it is cleared.                                                                                                                                                                                         |
| `onRetry`                  | `() => void`                                                 |         | Offered as the error state's one action. Optional, and the `error` slot draws no button without it — the engine has no idea how to retry a load it never performed, so the action exists only when the caller says what it does.                                                  |
| `onClearFilters`           | `() => void`                                                 |         | The filtered-empty state's one action. Same contract as `onRetry`: the page owns the filters (see `isFiltered`), so it is the only thing that can clear them.                                                                                                                     |
| `render` (required)        | `TableRender<T>`                                             |         | The skin that draws every part: `tableRender<Row>()` from `@bh/ui`.                                                                                                                                                                                                               |
| `rowHeight`                | `number \| ((row: T \| undefined, index: number) => number)` | `40`    | Height of a data row in pixels, or a function of the row and its index for rows of different heights. The virtualizer needs it up front, so a caller with a density toggle passes the height for the current mode.                                                                |
| `rowOverlay`               | `(row: T) => ReactNode`                                      |         | Row-level chrome that is not a column — see `RenderTrCtx.overlay`.                                                                                                                                                                                                                |
| `status`                   | `ReactNode`                                                  |         | What the status bar says on the caller's behalf: "1–50 of 4,812", "page 2 of 97", "last refreshed 08:12".                                                                                                                                                                         |
| `isFiltered`               | `boolean`                                                    | `false` | Whether a filter is responsible for there being no rows. Forwarded to the `empty` slot, which needs it to choose its copy. The engine cannot infer it: it receives rows, never the query that produced them.                                                                      |
| `onEndReached`             | `() => void`                                                 |         | Called once the virtual window reaches the last rows, so a server-paged caller can fetch the next page. The engine does not know whether more rows exist or whether a fetch is already in flight — it only reports arrival at the end, and the caller decides what that is worth. |
| `stickyGroupHeader`        | `boolean`                                                    | `false` | Pin the current group's band under the column header while its rows scroll past.                                                                                                                                                                                                  |
