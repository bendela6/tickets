---
title: Sorting
summary: Sort by a header click, by several columns with shift-click, in the
  browser with sortRows or on a server.
order: 4
related: [Columns, useTable, Keyboard focus]
---

[//]: # 'written from sorting.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Sorting

Sort by a header click, by several columns with shift-click, in the
browser with `sortRows` or on a server.

## Clicking a header

A `sortable` column's header sorts the table. Each click steps it on:
ascending, descending, then not sorted. A plain click sorts by that
column alone, dropping any other; shift-click adds the column to the
sort instead, after the ones already there, and steps only its own
direction. The header numbers the columns once more than one sorts, and
the status bar under the table spells the sort out.

This table starts sorted by country. Shift-click Population to order
each country's cities by size, and click it again, with shift, to turn
that around:

**Sorting by two columns**

```tsx
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { NumberColumn, tableRender } from '@bh/ui';

interface City {
  id: string;
  name: string;
  country: string;
  population: number;
  /** Metres above the sea; not every city has one on record here. */
  elevation: number | null;
}

const CITIES: City[] = [
  { id: '1', name: 'Lisbon', country: 'Portugal', population: 545_000, elevation: 100 },
  { id: '2', name: 'Porto', country: 'Portugal', population: 232_000, elevation: null },
  { id: '3', name: 'Coimbra', country: 'Portugal', population: 140_000, elevation: 75 },
  { id: '4', name: 'Madrid', country: 'Spain', population: 3_332_000, elevation: 657 },
  { id: '5', name: 'Seville', country: 'Spain', population: 684_000, elevation: 7 },
  { id: '6', name: 'Granada', country: 'Spain', population: 228_000, elevation: 738 },
  { id: '7', name: 'Rome', country: 'Italy', population: 2_761_000, elevation: 21 },
  { id: '8', name: 'Turin', country: 'Italy', population: 848_000, elevation: 239 },
  { id: '9', name: 'Bologna', country: 'Italy', population: 392_000, elevation: null },
  { id: '10', name: 'Tbilisi', country: 'Georgia', population: 1_202_000, elevation: 490 },
  { id: '11', name: 'Kutaisi', country: 'Georgia', population: 131_000, elevation: 125 },
  { id: '12', name: 'Batumi', country: 'Georgia', population: 169_000, elevation: 3 },
];

const columns: Column<City>[] = [
  { key: 'country', header: 'Country', value: (city) => city.country, sortable: true, width: 150 },
  {
    key: 'name',
    header: 'City',
    value: (city) => city.name,
    sortable: true,
    width: 'minmax(140px, 1fr)',
  },
  {
    key: 'population',
    header: 'Population',
    value: (city) => city.population,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 150,
  },
  {
    key: 'elevation',
    header: 'Elevation (m)',
    value: (city) => city.elevation,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 150,
  },
];

export function SortingByTwoColumns() {
  const table = useTable({ initialSort: [{ field: 'country', direction: 'asc' }] });
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-320 w-full overflow-auto">
        <Table<City>
          {...table}
          columns={columns}
          rows={sortRows(CITIES, table.state.sort, columns)}
          isLoading={false}
          render={tableRender<City>()}
        />
      </div>
      <code className="text-12/17 text-gray-11 font-mono">
        sort: {JSON.stringify(table.state.sort)}
      </code>
    </div>
  );
}
```

The sort is a list, `state.sort`, the first entry the primary key:
`[{ field: 'country', direction: 'asc' }]`. From the keyboard, Enter on a
focused header does what a click does, and Shift+Enter what a
shift-click does ([Keyboard focus](keyboard-focus.md)).

## Ordering the rows

The table never reorders its rows. A click calls `onSortChange` with the
next sort, and the page puts the rows in that order, so the same table
serves rows sorted in the browser and rows a server sorts.

In the browser, `sortRows(rows, sort, columns)` orders them by each
column's `value`:

- Every key counts, in order; a later one only breaks the ties of those
  before it.
- Numbers, booleans and dates compare as such. Anything else compares as
  text, ignoring case and accents, with the numbers in it in order:
  "Item 9" before "Item 10".
- `null`, `undefined` and `NaN` go last, ascending or descending, as the
  missing elevations above do.
- Rows that tie keep the order they came in.
- A column with no `value` can't be sorted by, and is skipped.

It returns a new array, or the very same one when there is nothing to
sort by. On a server, send `state.sort` with the request instead, and
pass the rows that come back as they are.

## Rules

- A plain header click always collapses the sort to that one column.
- Shift-click is the only way to sort by more than one column, and it
  steps that column's direction in place without moving the others.
- Both step through ascending, descending and not sorted.
- A click on a column that isn't `sortable` does nothing.
- The table reports the sort and never applies it.

## Reference

```ts
interface SortBy<F extends string = string>
```

One column's place in a sort: the column and its direction. A table's sort
is a list of these, the first the primary key, each later one breaking the
ties of those before it.

| Member                 | Type                                 | Default | Description                                                      |
| ---------------------- | ------------------------------------ | ------- | ---------------------------------------------------------------- |
| `field` (required)     | `F`                                  |         | The sorted column's `key`.                                       |
| `direction` (required) | `'asc' \| 'desc'`: `'asc'`, `'desc'` |         | `asc` or `desc`. A column sorted neither way is not in the list. |

```ts
sortRows<T>(rows: T[], sort: SortBy[], columns: Column<T>[]): T[]
```

Orders rows by a table's sort, for a table sorted in the browser:

    <Table rows={sortRows(rows, table.state.sort, columns)} … />

Every key counts, in order, a later one only breaking the ties of those
before it. Each column's `value` is compared: numbers, booleans and dates as
such, anything else as text, ignoring case and putting the numbers within
it in order ("Item 9" before "Item 10"). A column without `value` is
skipped. `null`, `undefined` and `NaN` go last in both directions, and ties
keep the order they came in.

Returns a new array, or the same one when there is nothing to sort by.

| Parameter            | Type          | Default | Description                                        |
| -------------------- | ------------- | ------- | -------------------------------------------------- |
| `rows` (required)    | `T[]`         |         | The rows, as they came. Left as they are.          |
| `sort` (required)    | `SortBy[]`    |         | The table's sort: `state.sort`.                    |
| `columns` (required) | `Column<T>[]` |         | The table's columns, whose `value` each key reads. |

Returns `T[]`.

```ts
toggleSort(current: SortBy[], field: string): SortBy[]
```

The sort after a plain header click: by `field` alone, its direction one
step on from asc → desc → none. `field` steps on only while it is the
primary key; otherwise it starts at asc.

| Parameter            | Type       | Default | Description                  |
| -------------------- | ---------- | ------- | ---------------------------- |
| `current` (required) | `SortBy[]` |         | The sort now. Left as it is. |
| `field` (required)   | `string`   |         | The clicked column's key.    |

Returns `SortBy[]`.

```ts
multiSortToggle(current: SortBy[], field: string): SortBy[]
```

The sort after a shift-click: `field` joins at the end, ascending, or steps
on in place, asc → desc → gone. The other keys keep their order.

| Parameter            | Type       | Default | Description                     |
| -------------------- | ---------- | ------- | ------------------------------- |
| `current` (required) | `SortBy[]` |         | The sort now. Left as it is.    |
| `field` (required)   | `string`   |         | The shift-clicked column's key. |

Returns `SortBy[]`.
