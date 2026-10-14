---
title: Writing a skin
summary: Draw the table in a look of your own, or change one part of @bh/ui's,
  by writing the functions the table calls for each part.
order: 12
related: [Overview, Cell renderers, Keyboard focus]
---

[//]: # 'written from writing-a-skin.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Writing a skin

Draw the table in a look of your own, or change one part of `@bh/ui`'s,
by writing the functions the table calls for each part.

## What a skin is

`<Table render>` takes a `TableRender`: a function for each part of the
table, each handed what to draw. The table decides which parts to draw
and when, and draws nothing itself but the boxes they sit in: the frame,
a box that clips the columns and slides them sideways, and a dock at the
foot for the scrollbar and the status bar. `@bh/ui`'s skin is
`tableRender<Row>()`.

Eleven parts are required: `root`, `thead`, `th`, `tbody`, `tr`, `td`,
`groupHeader`, `skeletonRow`, `error`, `empty` and `tfoot`. The rest are
optional, and a skin without one draws none of what it would:
`filterRow` (no filter row), `selectCell` (no checkbox column),
`statusBar`, `hbar` (the docked scrollbar), `resizeGuide`, `scrim` (the
fades at hidden edges) and `frameClass` (classes for the frame, given how
far it is scrolled).

One optional member draws nothing: `onCopyCell`, which writes a cell's
text when Ctrl+C copies it and resolves to whether it did. The table
then hands that cell `copy`, `copied` or `failed`, for a moment, and
`td` shows it: `@bh/ui`'s skin writes with `copyText` and turns the
ring green or red, with a word. Without it the table writes the text
itself and shows nothing.

## A plain skin

This one draws the required parts with plain elements and a few classes,
and a resize grip with `useColumnResize`. It sorts, resizes, and moves by
keyboard like any table, because all of that is the table's.

**A plain skin**

```tsx
import {
  Table,
  sortRows,
  useColumnResize,
  useTable,
  type Column,
  type RenderThResize,
  type TableRender,
} from '@bh/table';
import { cn } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
}

const BOOKS: Book[] = [
  { id: '1', title: 'Invisible Cities', author: 'Italo Calvino', year: 1972 },
  { id: '2', title: 'Blindness', author: 'José Saramago', year: 1995 },
  { id: '3', title: 'The Book of Disquiet', author: 'Fernando Pessoa', year: 1982 },
  { id: '4', title: 'The Leopard', author: 'Giuseppe Tomasi di Lampedusa', year: 1958 },
  { id: '5', title: 'The Name of the Rose', author: 'Umberto Eco', year: 1980 },
  { id: '6', title: 'Don Quixote', author: 'Miguel de Cervantes', year: 1605 },
];

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, sortable: true, width: 220 },
  { key: 'author', header: 'Author', value: (b) => b.author, sortable: true, width: 240 },
  { key: 'year', header: 'Year', value: (b) => b.year, sortable: true, align: 'right', width: 90 },
];

/** A slot is a function, not a component: a hook goes in a component it draws. */
function Grip({ resize }: { resize: RenderThResize }) {
  const drag = useColumnResize({
    startWidth: resize.startWidth,
    minWidth: resize.minWidth,
    onChange: resize.onWidthChange,
  });
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      {...drag}
      onDoubleClick={resize.onAutoFit}
      className="hover:bg-gray-8 absolute top-0 right-0 h-full w-4 cursor-col-resize"
    />
  );
}

const cell = 'flex min-w-0 items-center px-12';

const plain: TableRender<Book> = {
  root: ({ children, rowCount, colCount }) => {
    return (
      <div
        role="grid"
        aria-rowcount={rowCount}
        aria-colcount={colCount}
        className="text-13/19 font-sans"
      >
        {children}
      </div>
    );
  },
  thead: ({ children, gridTemplate }) => {
    return (
      <div
        role="row"
        className="bg-gray-3 border-gray-7 sticky top-0 z-10 grid h-36 border-b-1"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {children}
      </div>
    );
  },
  th: ({ column, sort, onSortClick, resize, focusProps }) => {
    return (
      <div
        role="columnheader"
        aria-sort={sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
        // The roving tab stop and the cell's address: always spread.
        {...focusProps}
        className={cn(
          cell,
          'font-500 focus-visible:outline-indigo-9 relative focus-visible:outline-2',
        )}
      >
        {column.sortable ? (
          // Not a tab stop of its own: the cell is. Enter on the cell clicks it.
          <button type="button" tabIndex={-1} onClick={onSortClick} className="cursor-pointer">
            {column.header}
            {sort ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ) : (
          column.header
        )}
        {resize ? <Grip resize={resize} /> : null}
      </div>
    );
  },
  // The ref and the padding place the rows the virtualizer has mounted.
  tbody: ({ children, ref, style }) => {
    return (
      <div role="rowgroup" ref={ref} style={style}>
        {children}
      </div>
    );
  },
  tr: ({ cells, gridTemplate, style, ariaRowIndex, onClick }) => {
    return (
      <div
        role="row"
        aria-rowindex={ariaRowIndex}
        onClick={onClick}
        className="border-gray-5 hover:bg-gray-2 grid border-b-1"
        // `style` is the row's height, which the virtualizer counted on.
        style={{ ...style, gridTemplateColumns: gridTemplate }}
      >
        {cells}
      </div>
    );
  },
  td: ({ column, children, focused, focusProps }) => {
    return (
      <div
        role="gridcell"
        {...focusProps}
        className={cn(
          cell,
          column.align === 'right' && 'justify-end',
          focused && 'ring-indigo-9 ring-2 outline-none ring-inset',
        )}
      >
        {children}
      </div>
    );
  },
  groupHeader: ({ header, style }) => {
    return (
      <div role="row" style={style} className="bg-gray-2">
        <div role="gridcell" className={cn(cell, 'h-full')}>
          {header}
        </div>
      </div>
    );
  },
  skeletonRow: ({ columns: all, gridTemplate, rowHeight }) => {
    return (
      <div
        aria-hidden
        className="grid"
        style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
      >
        {all.map((column) => {
          return (
            <div key={column.key} className={cell}>
              <span className="bg-gray-4 rounded-4 h-8 w-3/5" />
            </div>
          );
        })}
      </div>
    );
  },
  error: ({ error, onRetry }) => {
    return (
      <div role="row">
        <div role="gridcell" className="p-24 text-center">
          <p role="alert">{error.message}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  },
  empty: ({ filtered }) => {
    return (
      <div role="row">
        <div role="gridcell" className="text-gray-11 p-24 text-center">
          {filtered ? 'No books match.' : 'No books yet.'}
        </div>
      </div>
    );
  },
  tfoot: ({ columns: all, gridTemplate }) => {
    return (
      <div role="row" className="grid h-32" style={{ gridTemplateColumns: gridTemplate }}>
        {all.map((column) => {
          return (
            <div key={column.key} role="gridcell" className={cell}>
              {column.footer}
            </div>
          );
        })}
      </div>
    );
  },
};

export function APlainSkin() {
  const table = useTable();
  return (
    <div className="border-gray-6 h-280 w-full overflow-auto border-1">
      <Table<Book>
        {...table}
        columns={columns}
        rows={sortRows(BOOKS, table.state.sort, columns)}
        isLoading={false}
        render={plain}
      />
    </div>
  );
}
```

## What every skin must do

- **Spread `focusProps`** onto the element `th` and `td` draw. It carries
  the keyboard's tab stop and the cell's address, `data-cell-row` and
  `data-cell-col`, by which the table finds a cell again after its row
  has scrolled away and back, and measures it to fit or resize a column.
- **Attach `tbody`'s `ref` and `style`** to the element that holds the
  rows. The ref tells the table where its rows start in the page; the
  style is the padding that stands in for the rows not drawn.
- **Apply `style` on `tr` and `groupHeader`.** It is the row's height,
  which the table counted on when it placed every row after it.
- **Lay rows out on `gridTemplate`**, which every row-shaped part is
  handed and `root` too, so a skin can set it once for the whole table.
- **Draw rows inside the grid.** `root` is `role="grid"`, and a grid holds
  rows: the empty and error states are a row holding one cell, whatever
  the cell holds.
- **Name the checkbox** `selectCell` draws with its `label`, and call its
  `onChange` with the click's `shiftKey`.

## Headers

Put `onSortClick` on the control that sorts. Enter on a focused header
clicks the first control in it, so that control comes first; a column's
`headerAccessory` goes after it, inside an element carrying
`HEADER_ACCESSORY_ATTR`, where Alt+↓ finds it. A slot is called as a
function, so a hook it needs, `useColumnResize` for one, goes in a
component it draws, as `Grip` above. Calling `resize.onDragChange` with
the width as it changes, and `null` when the drag ends, has the table
draw `resizeGuide` over every row.

## Pinned columns

A pinned cell is handed a `pin` (the totals, filter and skeleton rows a
`pins` map, since they draw their own cells): apply `pin.shift` as
`position: relative; left`, and give the cell an opaque background so the
columns sliding under it don't show through. `tr`'s `hasPinned` says when
a row needs a background of its own for a pinned cell to inherit. The
[Pinning](pinning.md) page has the rest.

## Changing one part

To change one part of `@bh/ui`'s look, spread its skin and replace that
function. Here the empty table offers to put the books back:

**Replacing one slot**

```tsx
import { useState } from 'react';
import { Table, useTable, type Column, type TableRender } from '@bh/table';
import { Button, tableRender } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  author: string;
}

const BOOKS: Book[] = [
  { id: '1', title: 'Invisible Cities', author: 'Italo Calvino' },
  { id: '2', title: 'Blindness', author: 'José Saramago' },
  { id: '3', title: 'The Book of Disquiet', author: 'Fernando Pessoa' },
];

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, width: 'minmax(180px, 1fr)' },
  { key: 'author', header: 'Author', value: (b) => b.author, width: 220 },
];

export function ReplacingOneSlot() {
  const table = useTable();
  const [books, setBooks] = useState(BOOKS);

  // @bh/ui's skin, with the empty state drawn here. Inside the grid, a slot
  // draws a row holding a cell, whatever it puts in the cell.
  const render: TableRender<Book> = {
    ...tableRender<Book>(),
    empty: () => {
      return (
        <div role="row">
          <div role="gridcell" className="flex flex-col items-center gap-8 px-16 py-32">
            <span className="text-13/19 text-gray-11">The shelf is empty.</span>
            <Button variant="outline" size="sm" onClick={() => setBooks(BOOKS)}>
              Put the books back
            </Button>
          </div>
        </div>
      );
    },
  };

  return (
    <div className="flex w-full flex-col items-start gap-8">
      <Button variant="ghost" size="sm" disabled={books.length === 0} onClick={() => setBooks([])}>
        Take every book off
      </Button>
      <div className="h-240 w-full overflow-auto">
        <Table<Book> {...table} columns={columns} rows={books} isLoading={false} render={render} />
      </div>
    </div>
  );
}
```

For the empty state's words alone, `tableRender({ empty: { title,
detail } })` is enough ([Virtualization and
states](virtualization-and-states.md)).

## Testing

`makeStubRender()` is a skin with no look, for tests: each part draws a
plain element marked `data-slot` (`th`, `tr`, `td`, `empty`, ...) with
what it was handed as data attributes, so a test checks what the table
asked for without any real chrome.

## Rules

- The table draws every header, row, cell, band and state through the
  skin, and nothing of its own but the frame, the clip and the dock.
- `focusProps`, `tbody`'s `ref` and `style`, and a row's `style` are
  always applied, or focus, scrolling and row positions break.
- A skin without an optional part loses that feature, and nothing else.
- Each part is called as a function during the table's render, not
  mounted as a component.

## Reference

```ts
interface TableRender<T = unknown>
```

A skin: a function per part of the table, each handed what to draw.
`<Table>` calls them, and draws only the plain boxes they sit in: the
frame, the box that clips the columns, and the dock at the foot. `@bh/ui`'s
skin is `tableRender()`.

| Member                   | Type                                          | Default | Description                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root` (required)        | `(ctx: RenderRootCtx) => ReactNode`           |         | The element around the whole table: `role="grid"`.                                                                                                                                                                                |
| `thead` (required)       | `(ctx: RenderTheadCtx) => ReactNode`          |         | The header row, around its cells.                                                                                                                                                                                                 |
| `th` (required)          | `(ctx: RenderThCtx<T>) => ReactNode`          |         | One header cell.                                                                                                                                                                                                                  |
| `tbody` (required)       | `(ctx: RenderTbodyCtx) => ReactNode`          |         | The element that holds the rows.                                                                                                                                                                                                  |
| `tr` (required)          | `(ctx: RenderTrCtx<T>) => ReactNode`          |         | One data row, around its cells.                                                                                                                                                                                                   |
| `td` (required)          | `(ctx: RenderTdCtx<T>) => ReactNode`          |         | One cell.                                                                                                                                                                                                                         |
| `groupHeader` (required) | `(ctx: RenderGroupHeaderCtx) => ReactNode`    |         | A group's band, and its pinned copy with `stickyGroupHeader`.                                                                                                                                                                     |
| `skeletonRow` (required) | `(ctx: RenderSkeletonRowCtx<T>) => ReactNode` |         | A placeholder row while the table loads with no rows.                                                                                                                                                                             |
| `error` (required)       | `(ctx: RenderErrorCtx) => ReactNode`          |         | The body while the table has an `error`.                                                                                                                                                                                          |
| `empty` (required)       | `(ctx: RenderEmptyCtx) => ReactNode`          |         | The body when there are no rows.                                                                                                                                                                                                  |
| `tfoot` (required)       | `(ctx: RenderTfootCtx<T>) => ReactNode`       |         | The totals row, when a column has a `footer`.                                                                                                                                                                                     |
| `filterRow`              | `(ctx: RenderFilterRowCtx<T>) => ReactNode`   |         | Optional: a render set without it simply draws no filter row, and a column's `filter` is ignored — the same trade as `selectCell`.                                                                                                |
| `selectCell`             | `(ctx: RenderSelectCellCtx) => ReactNode`     |         | Optional: a render set that does not draw checkboxes simply cannot host a `select` column, rather than every existing render set breaking.                                                                                        |
| `statusBar`              | `(ctx: RenderStatusBarCtx) => ReactNode`      |         | The bar across the bottom of the table: how many rows, what is selected, whatever the caller wants said about the page it is showing.                                                                                             |
| `frameClass`             | `(ctx: { scrollX: ScrollX }) => string`       |         | Classes for the FRAME, given how far the table is scrolled sideways.                                                                                                                                                              |
| `hbar`                   | `(ctx: RenderHbarCtx) => ReactNode`           |         | The docked horizontal scrollbar — drawn, not native.                                                                                                                                                                              |
| `resizeGuide`            | `(ctx: RenderResizeGuideCtx) => ReactNode`    |         | The line and the width chip shown while a column is being resized.                                                                                                                                                                |
| `scrim`                  | `(ctx: RenderScrimCtx) => ReactNode`          |         | The soft edge where content passes out of sight: beside a frozen column, and at whichever side of the frame is hiding columns.                                                                                                    |
| `onCopyCell`             | `(text: string) => Promise<boolean>`          |         | Writes a cell's text to the clipboard when Ctrl+C (Cmd+C) copies the focused cell, and resolves to whether it did. The table then hands that cell `RenderTdCtx.copy` for a moment, so `td` can show it worked, or that it failed. |

```ts
interface RenderRootCtx
```

What the `root` slot is handed: the element every other part of the table
is drawn inside, `role="grid"` in `@bh/ui`.

| Member                    | Type        | Default | Description                                                                                                       |
| ------------------------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `children` (required)     | `ReactNode` |         | The header, the body, and the totals row when there is one.                                                       |
| `gridTemplate` (required) | `string`    |         | The column tracks, for a render set that wants to declare them ONCE for the whole table rather than on every row. |
| `rowCount` (required)     | `number`    |         | The table's TRUE size, header row included — what `aria-rowcount` and `aria-colcount` must report.                |
| `colCount` (required)     | `number`    |         | The number of columns, for `aria-colcount`.                                                                       |

```ts
interface RenderTheadCtx
```

What the `thead` slot is handed: the header row around its cells, and the
filter row when there is one.

| Member                    | Type        | Default | Description                                                                                                                                                                                                                                                           |
| ------------------------- | ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children` (required)     | `ReactNode` |         | The header cells, one `th` slot per column.                                                                                                                                                                                                                           |
| `gridTemplate` (required) | `string`    |         | The columns' `grid-template-columns`: each column's dragged width, else its `width`, else `160px`.                                                                                                                                                                    |
| `refreshing` (required)   | `boolean`   |         | Rows are on screen and a fresh page is on its way. The header is where that gets said — a progress line along its bottom rule — because it is the one part of the table that is not being replaced.                                                                   |
| `filterRow`               | `ReactNode` |         | The filter row, already rendered by the `filterRow` slot, when any column has a `filter`. Handed to the header so it can sit inside the header's own sticky box: the two stick as one, and nothing has to know how tall the header is to put the filter row under it. |

```ts
interface RenderThCtx<T>
```

What the `th` slot is handed for one column's header cell.

| Member                   | Type                                            | Default | Description                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `column` (required)      | `Column<T>`                                     |         | The column.                                                                                                                                                                                                   |
| `index` (required)       | `number`                                        |         | Zero-based position of this column in `columns`. A render set needs it to treat the leading column differently from the rest (the design's wider edge gutter); `column.key` cannot answer "am I first?".      |
| `sort`                   | `{ direction: 'asc' \| 'desc'; index: number }` |         | How this column sorts, and its place in the sort from 0; absent when it doesn't.                                                                                                                              |
| `totalSorts` (required)  | `number`                                        |         | How many columns the table sorts by. A skin shows `sort.index` only past one.                                                                                                                                 |
| `onSortClick` (required) | `(e: MouseEvent) => void`                       |         | Put it on the control that sorts: a click sorts by this column alone, a shift-click adds it to the sort. Does nothing on a column that isn't `sortable`.                                                      |
| `resize`                 | `RenderThResize`                                |         | The resize handle's numbers; absent when the column isn't resizable.                                                                                                                                          |
| `focused`                | `boolean`                                       |         | This header cell holds the grid's focus. The ring is the ADAPTER's to draw — the engine has no business owning a colour.                                                                                      |
| `focusProps` (required)  | `CellFocusProps`                                |         | MUST be spread onto the header cell element.                                                                                                                                                                  |
| `pin`                    | `CellPin`                                       |         | Set when `column.pinned` is. The skin applies `pin.shift` as `position: relative; left`; the engine supplies the arithmetic, never the CSS.                                                                   |
| `trailing`               | `boolean`                                       |         | This is the last column, and the columns do not fill the frame.                                                                                                                                               |
| `children`               | `ReactNode`                                     |         | Content to render INSTEAD of `column.header`, when the engine owns what goes in the header cell. Today that means one thing: the select-all checkbox above a `select` column. Mirrors `RenderTdCtx.children`. |

```ts
interface RenderThResize
```

A header cell's resize handle: where a drag starts, and where its widths
go. Absent for a column with `resizable: false`.

| Member                     | Type                              | Default | Description                                                                                                                                     |
| -------------------------- | --------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `startWidth` (required)    | `number`                          |         | The column's width as the table knows it: dragged, else its numeric `width`, else 160. `useColumnResize` measures the cell instead when it can. |
| `minWidth`                 | `number`                          |         | The column's `minWidth`.                                                                                                                        |
| `onWidthChange` (required) | `(px: number) => void`            |         | Sets the column's width, in pixels: call it as the drag moves.                                                                                  |
| `onAutoFit` (required)     | `() => void`                      |         | Fits the column to its widest cell on screen, never below `minWidth`: the double-click on the handle.                                           |
| `onDragChange`             | `(width: number \| null) => void` |         | Report the width a drag is currently proposing, and `null` when it ends.                                                                        |

```ts
interface RenderTbodyCtx
```

What the `tbody` slot is handed: the element that holds the rows, with the
ref and the padding that place the mounted ones.

| Member                 | Type                                | Default | Description                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children` (required)  | `ReactNode`                         |         | The mounted rows and group bands, in order.                                                                                                                                                                       |
| `ref` (required)       | `(el: HTMLElement \| null) => void` |         | MUST be attached to the element that holds the rows.                                                                                                                                                              |
| `totalSize` (required) | `number`                            |         | Scroll height of every row, mounted or not. Informational — the rowgroup no longer sets this as an explicit height, because the padding in `style` plus the mounted rows already add up to exactly it.            |
| `style` (required)     | `CSSProperties`                     |         | The virtualization padding: how much row there is above the mounted window, and how much below. MUST be applied, or every mounted row sits at the top of the scroll region no matter where the table is scrolled. |

```ts
interface RenderTrCtx<T>
```

What the `tr` slot is handed for one data row.

| Member                    | Type            | Default | Description                                                                                                                                                                                                                                                                              |
| ------------------------- | --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `row` (required)          | `T`             |         | The row.                                                                                                                                                                                                                                                                                 |
| `index` (required)        | `number`        |         | Its place among the rows on screen, from 0, counted across groups.                                                                                                                                                                                                                       |
| `ariaRowIndex` (required) | `number`        |         | This row's `aria-rowindex`: 1-based, counting the rows above the data — the column header, and the filter row when there is one. The engine's because only it knows how many header rows there are; `index + 2` stops being true the moment a filter row appears.                        |
| `cells` (required)        | `ReactNode`     |         | The row's cells, one `td` slot per column.                                                                                                                                                                                                                                               |
| `gridTemplate` (required) | `string`        |         | The columns' tracks — see `RenderTheadCtx.gridTemplate`.                                                                                                                                                                                                                                 |
| `style` (required)        | `CSSProperties` |         | The row's height. MUST be applied — the virtualizer sized the scroll region on the assumption this row is exactly this tall, so a row that ignores it puts every row after it at the wrong offset.                                                                                       |
| `onClick`                 | `() => void`    |         | The table's `onRowClick` for this row; absent without one.                                                                                                                                                                                                                               |
| `overlay`                 | `ReactNode`     |         | Row-level chrome that is NOT a column — hover actions floating over the row's right edge, a peek hint. Rendered after the cells, inside the row, which the virtualizer has already positioned; an absolutely-positioned overlay therefore resolves against the row rather than the page. |
| `selected`                | `boolean`       |         | This row is in the selection. The treatment is the ADAPTER's to choose.                                                                                                                                                                                                                  |
| `hasPinned`               | `boolean`       |         | Some column in this table is pinned.                                                                                                                                                                                                                                                     |
| `dimmed`                  | `boolean`       |         | This row's values are stale: a refresh is in flight over rows that are already on screen. They stay exactly where they are and read back a step, so a number you are looking at cannot be mistaken for a fresh one.                                                                      |

```ts
interface RenderTdCtx<T>
```

What the `td` slot is handed for one cell.

| Member                  | Type                               | Default | Description                                                                                                                                                                                        |
| ----------------------- | ---------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `column` (required)     | `Column<T>`                        |         | The cell's column.                                                                                                                                                                                 |
| `index` (required)      | `number`                           |         | Zero-based column position, matching `RenderThCtx.index` — a cell has to reach the same gutter decision its header did or the two fall out of alignment.                                           |
| `row` (required)        | `T`                                |         | The cell's row.                                                                                                                                                                                    |
| `children` (required)   | `ReactNode`                        |         | The content: `column.render(row)`, else `column.as({ value, row })`, else `column.value(row)` as text; the checkbox in a `select` column.                                                          |
| `focused`               | `boolean`                          |         | This cell holds the grid's focus. The ring is the ADAPTER's to draw.                                                                                                                               |
| `focusProps` (required) | `CellFocusProps`                   |         | MUST be spread onto the cell element.                                                                                                                                                              |
| `pin`                   | `CellPin`                          |         | Set when `column.pinned` is — see `RenderThCtx.pin`.                                                                                                                                               |
| `trailing`              | `boolean`                          |         | This is the last column AND the table does not fill its frame — see `RenderThCtx.trailing`.                                                                                                        |
| `copy`                  | `CellCopy`: `'copied'`, `'failed'` |         | Set for a moment after Ctrl+C copied this cell, to say how it went. Only a skin with `onCopyCell` is told, since only it says whether the copy worked; what that looks like is the skin's to draw. |

```ts
type CellCopy = 'copied' | 'failed';
```

How a cell's copy went: `copied`, or `failed` when the clipboard refused.

One of `'copied'`, `'failed'`.

```ts
interface RenderGroupHeaderCtx
```

What the `groupHeader` slot is handed for one group's band.

| Member                    | Type            | Default | Description                                                                                                                                                                                                                                                           |
| ------------------------- | --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key` (required)          | `string`        |         | The group's `key`.                                                                                                                                                                                                                                                    |
| `header` (required)       | `ReactNode`     |         | The group's `header`.                                                                                                                                                                                                                                                 |
| `gridTemplate` (required) | `string`        |         | The columns' tracks — see `RenderTheadCtx.gridTemplate`. A band may span them rather than lay out on them.                                                                                                                                                            |
| `style` (required)        | `CSSProperties` |         | The band's height — see `RenderTrCtx.style`. Empty for the sticky copy, which is not in the virtual list.                                                                                                                                                             |
| `collapsed` (required)    | `boolean`       |         | Whether this group's rows are hidden.                                                                                                                                                                                                                                 |
| `sticky`                  | `boolean`       |         | True for the extra copy pinned under the column header. The real band leaves the DOM once it scrolls out of the virtual window, so the pinned band is a second rendering, and `style` is empty for it. The render set decides where it sticks and what it looks like. |
| `belowFilterRow`          | `boolean`       |         | The table has a filter row, so the sticky copy has to land under it rather than directly under the column header.                                                                                                                                                     |
| `onToggle`                | `() => void`    |         | Absent when the caller supplies no `onCollapseChange` — collapsing is opt-in, like focus and selection, so a band that cannot collapse must not render a disclosure control that does nothing.                                                                        |

```ts
interface RenderSkeletonRowCtx<T>
```

What the `skeletonRow` slot is handed: one placeholder row, drawn ten
times while the table loads with no rows.

| Member                    | Type          | Default | Description                                                                                                                                                                                                                         |
| ------------------------- | ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns` (required)      | `Column<T>[]` |         | Every column, in order: a placeholder cell for each.                                                                                                                                                                                |
| `gridTemplate` (required) | `string`      |         | The columns' tracks — see `RenderTheadCtx.gridTemplate`.                                                                                                                                                                            |
| `trailing`                | `boolean`     |         | The last column has empty frame after it — see `RenderThCtx.trailing`.                                                                                                                                                              |
| `rowHeight` (required)    | `number`      |         | The caller's data row height, so a placeholder is the same height as the real rows it stands in for (e.g. a compact density's 32px rather than the engine's ROW_HEIGHT default).                                                    |
| `pins` (required)         | `RowPins`     |         | Where each frozen column sticks — see `RowPins`. A skeleton lays out on the same tracks as the rows it stands in for, so a table scrolled sideways while it loads has to show the frozen columns where the real rows will put them. |

```ts
interface RenderErrorCtx
```

What the `error` slot is handed: drawn as the table's body, under the
header, while the table has an `error`.

| Member             | Type         | Default | Description                                                                                                                                                   |
| ------------------ | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error` (required) | `Error`      |         | The table's `error`.                                                                                                                                          |
| `onRetry`          | `() => void` |         | The state's one action, present only when the caller supplied `onRetry`. A render set draws no button without it rather than inventing one that does nothing. |

```ts
interface RenderEmptyCtx
```

What the `empty` slot is handed: drawn as the table's body, under the
header, when there are no rows, no error and nothing loading.

| Member                | Type         | Default | Description                                                                                                                                                                                                |
| --------------------- | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filtered` (required) | `boolean`    |         | Why the table is empty. "Nothing here yet" and "your filters hide everything" need different copy and different actions, and only the caller knows which applies — the engine is handed rows, not a query. |
| `onClearFilters`      | `() => void` |         | Clears whatever `filtered` is about. Only ever meaningful alongside it, and only present when the caller supplied `onClearFilters` — the engine never sees the query, so it cannot clear one.              |

```ts
interface RenderTfootCtx<T>
```

What the `tfoot` slot is handed: the totals row, a cell per column holding
its `footer`, pinned to the bottom while there are rows.

| Member                    | Type          | Default | Description                                                                                                                              |
| ------------------------- | ------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `columns` (required)      | `Column<T>[]` |         | Every column, in order; one without a `footer` gets an empty cell.                                                                       |
| `gridTemplate` (required) | `string`      |         | The columns' tracks — see `RenderTheadCtx.gridTemplate`.                                                                                 |
| `trailing`                | `boolean`     |         | The last column has empty frame after it — see `RenderThCtx.trailing`.                                                                   |
| `pins` (required)         | `RowPins`     |         | Where each frozen column sticks — see `RowPins`.                                                                                         |
| `bottomOffset` (required) | `number`      |         | How far above the bottom of the viewport the totals row must pin, in pixels: the height of the scrollbar and status bar docked below it. |

```ts
interface RenderFilterRowCtx<T>
```

The filter row: one cell per column, holding `column.filter`. One slot rather
than a row slot plus a cell slot, like `tfoot` — its content comes entirely
from the columns, so all the engine hands over per cell is what the render
set cannot read off a column itself, which is the pins.

| Member                    | Type          | Default | Description                                                                                                                                                                                       |
| ------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns` (required)      | `Column<T>[]` |         | Every column, in order; a column without a `filter` gets an empty cell.                                                                                                                           |
| `gridTemplate` (required) | `string`      |         | The columns' tracks — see `RenderTheadCtx.gridTemplate`.                                                                                                                                          |
| `trailing`                | `boolean`     |         | The last column has empty frame after it — see `RenderThCtx.trailing`.                                                                                                                            |
| `pins` (required)         | `RowPins`     |         | Where each frozen column sticks — see `RowPins`. The filter row is inside the sheet that slides, so a frozen column's filter has to hold still with it or it walks out from under its own header. |

```ts
interface RenderSelectCellCtx
```

The selection checkbox, in a row or above the column. The engine knows what
is selected; the render set knows what a checkbox looks like, and that is
the whole division here.

| Member                | Type                          | Default | Description                                                                                                                                           |
| --------------------- | ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checked` (required)  | `boolean`                     |         | In a row, the row is selected; in the header, every row is.                                                                                           |
| `indeterminate`       | `boolean`                     |         | Header only: some rows are selected but not all.                                                                                                      |
| `isHeader` (required) | `boolean`                     |         | True for the select-all cell in the column header.                                                                                                    |
| `onChange` (required) | `(shiftKey: boolean) => void` |         | Call it when the box is clicked, with the click's `shiftKey`: a shift-click in a row adds every row between it and the last row ticked without shift. |
| `label` (required)    | `string`                      |         | Accessible name. A checkbox column shows no visible label, so a render set MUST attach this or every checkbox in the table is anonymous.              |

```ts
interface RenderStatusBarCtx
```

What the `statusBar` slot is handed: the bar docked under the table.

| Member                     | Type        | Default | Description                                                                                                                         |
| -------------------------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `rowCount` (required)      | `number`    |         | Rows the table is holding — which is not the same as rows that exist on a server. Anything the engine cannot know goes in `status`. |
| `selectedCount` (required) | `number`    |         | How many rows are selected.                                                                                                         |
| `sort` (required)          | `SortBy[]`  |         | The table's sort.                                                                                                                   |
| `status`                   | `ReactNode` |         | Whatever the caller passed as `status`: a page number, a server total, a last-refreshed time. Rendered as given.                    |

```ts
interface RenderHbarCtx
```

What the `hbar` slot is handed: the horizontal scrollbar docked at the
table's foot, drawn while the columns are wider than the frame.

| Member                   | Type                                                                                                                                                                                                                                                  | Default | Description                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `thumbWidth` (required)  | `number`                                                                                                                                                                                                                                              |         | Thumb width in pixels — the visible fraction of the table, floored so it stays grabbable on a very wide one. |
| `thumbOffset` (required) | `number`                                                                                                                                                                                                                                              |         | How far along the track the thumb sits, in pixels from its left edge.                                        |
| `dragging` (required)    | `boolean`                                                                                                                                                                                                                                             |         | True while the thumb is being dragged.                                                                       |
| `visible` (required)     | `boolean`                                                                                                                                                                                                                                             |         | Whether the bar is worth showing at all right now.                                                           |
| `thumbProps` (required)  | `{ onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void; onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void; onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void; onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void; }` |         | Spread onto the thumb.                                                                                       |
| `trackProps` (required)  | `{ onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void; }`                                                                                                                                                                                     |         | Spread onto the track, for click-to-jump.                                                                    |

```ts
interface RenderResizeGuideCtx
```

What the `resizeGuide` slot is handed while a column is dragged: drawn
once, over the whole table.

| Member             | Type     | Default | Description                                                                                                                                 |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `left` (required)  | `number` |         | Pixels from the table's left edge to the column's projected new edge, in the sheet's own coordinates — so it stays put as the table slides. |
| `width` (required) | `number` |         | The width the column would take if the drag ended now.                                                                                      |
| `delta` (required) | `number` |         | How much that is bigger (+) or smaller (−) than the width it started at.                                                                    |

```ts
interface RenderScrimCtx
```

What the `scrim` slot is handed, once per edge where columns pass out of
sight: beside the frozen columns, or at a side of the frame.

| Member              | Type                                                           | Default | Description                                                                                                                                 |
| ------------------- | -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind` (required)   | `'freeze' \| 'start' \| 'end'`: `'freeze'`, `'start'`, `'end'` |         | Which edge this is.                                                                                                                         |
| `offset` (required) | `number`                                                       |         | Pixels from the frame's left edge (`freeze`, `start`) or its right edge (`end`).                                                            |
| `bottom` (required) | `number`                                                       |         | Pixels of the frame's bottom already spoken for by the scrollbar and the status bar, so the fade stops above them rather than running over. |

```ts
const HEADER_ACCESSORY_ATTR: 'data-header-accessory';
```

The attribute a skin puts on the element wrapping `column.headerAccessory`.
Alt+↓ on a focused header cell clicks the first control inside it.

```ts
makeStubRender<T>(): TableRender<T>
```

An unstyled skin for tests. Each slot draws a plain element marked with
`data-slot` (`th`, `tr`, `td`, `empty`, ...) and the context it was handed as
data attributes, so a test can check what the table asked for without any
real chrome.

Returns `TableRender<T>`.
