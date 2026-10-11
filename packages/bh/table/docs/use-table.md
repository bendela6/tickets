---
title: useTable
summary: Hold a table's sort, widths, collapsed groups, focused cell and
  selection in one hook, or own any of them yourself.
order: 3
related: [Overview, Sorting, Widths and resizing]
---

[//]: # 'written from use-table.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useTable

Hold a table's sort, widths, collapsed groups, focused cell and selection
in one hook, or own any of them yourself.

## The hook

`<Table>` holds no state: it is drawn from a `TableState` and calls a
handler when the user changes it. `useTable` holds one, and returns it
with its handlers under the names `<Table>` takes, so the whole of it is
spread onto the table:

```tsx
import { Table, useTable, type Column } from '@bh/table';
import { tableRender } from '@bh/ui';

interface Order {
  id: string;
  total: number;
}
declare const columns: Column<Order>[];
declare const orders: Order[];

export function Orders() {
  const table = useTable({ storageKey: 'shop:orders' });
  return (
    <Table
      {...table}
      columns={columns}
      rows={orders}
      isLoading={false}
      render={tableRender<Order>()}
    />
  );
}
```

Its options set where the table starts: `initialSort`,
`initialCollapsed` (group keys) and `initialSelected` (row ids), and
`storageKey`, the name the dragged widths are saved under
([Widths and resizing](widths-and-resizing.md)). The three
`initial` options are read on the first render only.

Three of its handlers turn a behaviour on by being there:
`onFocusChange` the [keyboard focus](keyboard-focus.md),
`onCollapseChange` the [group](groups.md) toggles, and
`onSelectionChange`, with a `getRowId` of yours, the
[selection](selection.md). To leave one off, pass `undefined` for
it after the spread.

## Owning one piece

The props are ordinary props, so a page that keeps one piece of the state
itself (the sort in the address, say, or set from a control above the
table) passes its own after the spread: its value inside `state`, and its
handler. Everything else stays with the hook.

**Sort from outside**

```tsx
import { useState } from 'react';
import { Table, sortRows, useTable, type Column, type SortBy } from '@bh/table';
import { NumberColumn, SegmentedControl, tableRender } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  pages: number;
}

const BOOKS: Book[] = [
  { id: '1', title: 'The Leopard', author: 'Giuseppe Tomasi di Lampedusa', year: 1958, pages: 330 },
  { id: '2', title: 'Blindness', author: 'José Saramago', year: 1995, pages: 352 },
  { id: '3', title: 'The Book of Disquiet', author: 'Fernando Pessoa', year: 1982, pages: 544 },
  { id: '4', title: 'Invisible Cities', author: 'Italo Calvino', year: 1972, pages: 165 },
  { id: '5', title: 'The Shadow of the Wind', author: 'Carlos Ruiz Zafón', year: 2001, pages: 487 },
  {
    id: '6',
    title: 'A Man Was Going Down the Road',
    author: 'Otar Chiladze',
    year: 1973,
    pages: 384,
  },
  { id: '7', title: 'The Name of the Rose', author: 'Umberto Eco', year: 1980, pages: 536 },
  { id: '8', title: 'Don Quixote', author: 'Miguel de Cervantes', year: 1605, pages: 992 },
  { id: '9', title: 'Baltasar and Blimunda', author: 'José Saramago', year: 1982, pages: 352 },
  {
    id: '10',
    title: 'If on a Winter’s Night a Traveler',
    author: 'Italo Calvino',
    year: 1979,
    pages: 260,
  },
];

const columns: Column<Book>[] = [
  {
    key: 'title',
    header: 'Title',
    value: (book) => book.title,
    sortable: true,
    width: 'minmax(200px, 1fr)',
  },
  { key: 'author', header: 'Author', value: (book) => book.author, sortable: true, width: 220 },
  {
    key: 'year',
    header: 'Year',
    value: (book) => book.year,
    align: 'right',
    sortable: true,
    width: 90,
  },
  {
    key: 'pages',
    header: 'Pages',
    value: (book) => book.pages,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 100,
  },
];

const ORDERS = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'year', label: 'Year' },
];

export function SortFromOutside() {
  const table = useTable();
  // The page holds the sort, so the control above the table and its headers
  // change the same value. Everything else stays with useTable.
  const [sort, setSort] = useState<SortBy[]>([{ field: 'year', direction: 'asc' }]);
  return (
    <div className="flex w-full flex-col gap-12">
      <SegmentedControl
        label="Sort by"
        options={ORDERS}
        value={sort[0]?.field ?? ''}
        onChange={(field) => setSort([{ field, direction: 'asc' }])}
      />
      <div className="h-320 w-full overflow-auto">
        <Table<Book>
          {...table}
          state={{ ...table.state, sort }}
          onSortChange={setSort}
          columns={columns}
          rows={sortRows(BOOKS, sort, columns)}
          isLoading={false}
          render={tableRender<Book>()}
        />
      </div>
    </div>
  );
}
```

The control and the headers change the same sort, so each shows what the
other did: click the Pages header and the control lets go of its choice,
since no option is sorting.

## Rules

- `<Table>` is controlled: it shows `state` and changes nothing until a
  handler is called and a new `state` comes back.
- `initialSort`, `initialCollapsed` and `initialSelected` are read on the
  first render only.
- The focused cell starts as `null`: no ring shows until the user puts
  focus in the table, though the first cell is already its tab stop.
- A table that owns a piece passes both halves, the value in `state` and
  the handler, or the table shows one and changes the other.

## Reference

```ts
useTable(opts?: UseTableOptions): UseTableResult
```

Holds a table's state for you: its sort, its widths (saved under
`storageKey`), its collapsed groups, its focused cell and its selection.
Spread what it returns onto `<Table>`:

    const table = useTable({ storageKey: 'shop:orders' });
    <Table {...table} columns={columns} rows={rows} … />

A caller that owns one of these fields — sort pushed into the URL, say —
passes its own `state` and handler after the spread; they are ordinary
props.

| Parameter               | Type              | Default | Description                                                                                                                                                                                                    |
| ----------------------- | ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opts`                  | `UseTableOptions` | `{}`    | Where the table starts, and the key its widths are saved under.                                                                                                                                                |
| `opts.initialSort`      | `SortBy[]`        |         | The sort to start with. Nothing sorts without it.                                                                                                                                                              |
| `opts.storageKey`       | `string`          |         | Persist column widths under `${storageKey}:widths`. The app names it (`shop:orders`), so two apps on one origin never share it. Omit and the widths live only as long as the component — see `useTableWidths`. |
| `opts.initialCollapsed` | `string[]`        |         | Keys of the groups to start collapsed.                                                                                                                                                                         |
| `opts.initialSelected`  | `string[]`        |         | Ids of the rows to start selected.                                                                                                                                                                             |

Returns `UseTableResult`.

```ts
interface UseTableOptions
```

`useTable`'s options: where the table starts, and where it keeps its
widths.

| Member             | Type       | Default | Description                                                                                                                                                                                                    |
| ------------------ | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialSort`      | `SortBy[]` |         | The sort to start with. Nothing sorts without it.                                                                                                                                                              |
| `storageKey`       | `string`   |         | Persist column widths under `${storageKey}:widths`. The app names it (`shop:orders`), so two apps on one origin never share it. Omit and the widths live only as long as the component — see `useTableWidths`. |
| `initialCollapsed` | `string[]` |         | Keys of the groups to start collapsed.                                                                                                                                                                         |
| `initialSelected`  | `string[]` |         | Ids of the rows to start selected.                                                                                                                                                                             |

```ts
interface UseTableResult
```

What `useTable` returns: a `TableState` and a handler for each of its
fields, named as `<Table>`'s props are, to spread onto it.

| Member                         | Type                                | Default | Description                                                                          |
| ------------------------------ | ----------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `state` (required)             | `TableState`                        |         | The sort, widths, collapsed groups, focused cell and selection.                      |
| `onSortChange` (required)      | `(next: SortBy[]) => void`          |         | Records a new sort.                                                                  |
| `onWidthChange` (required)     | `(key: string, px: number) => void` |         | Records a column's width, and saves it under the storage key.                        |
| `onCollapseChange` (required)  | `(next: Set<string>) => void`       |         | Records the collapsed groups. Passed to `<Table>`, it turns collapsing on.           |
| `onFocusChange` (required)     | `(next: CellRef \| null) => void`   |         | Records the focused cell. Passed to `<Table>`, it turns the keyboard focus model on. |
| `onSelectionChange` (required) | `(next: Set<string>) => void`       |         | Records the selection. Passed to `<Table>` with `getRowId`, it turns selection on.   |

```ts
interface TableState
```

Everything the table is drawn from that changes as it is used: the sort,
the dragged widths, the collapsed groups, the focused cell and the
selection. `useTable` holds one; a caller that owns a field passes its own.

Every field past `sort` and `widths` is optional, so a caller can adopt
them one at a time.

| Member              | Type                     | Default | Description                                                                                                                           |
| ------------------- | ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `sort` (required)   | `SortBy[]`               |         | The sort, primary key first. Empty when nothing sorts.                                                                                |
| `widths` (required) | `Record<string, number>` |         | Widths the user has dragged, in pixels, by column key. They win over each column's own `width`.                                       |
| `collapsed`         | `Set<string>`            |         | Keys of the collapsed groups. A collapsed group keeps its band and drops its rows.                                                    |
| `focused`           | `CellRef \| null`        |         | The focused cell. Supplying `onFocusChange` is what turns the focus model on; without it the engine leaves the tab order alone.       |
| `selected`          | `Set<string>`            |         | Selected row IDs. Ids and not indices: under sort, filter and windowed loading the row at index 4 is not the row it was a moment ago. |
