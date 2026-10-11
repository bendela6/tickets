---
title: Virtualization and states
summary: Show ten thousand rows by drawing only those in view, load more as the
  user nears the end, and show loading, empty and failed tables.
order: 10
related: [Overview, Groups, Writing a skin]
---

[//]: # 'written from virtualization-and-states.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Virtualization and states

Show ten thousand rows by drawing only those in view, load more as the
user nears the end, and show loading, empty and failed tables.

## Only the rows in view

The table draws the rows in view and a few either side, whatever the
length of `rows`, and pads the space for the rest so the scrollbar is
true. It has no scroll box of its own: the nearest ancestor that scrolls
vertically scrolls it, which in an app is the shell's main area, and its
header sticks to that ancestor's top. It fills at least the rest of that
ancestor's height, and never less than 200 pixels.

A row's height is known before the row is drawn: `rowHeight` is a number
of pixels, 40 (`ROW_HEIGHT`) without one, or a function of the row and
its index for rows of different heights. `@bh/ui`'s `rowHeightFor`
gives its two densities, 42 for `comfortable` and 32 for `compact`. A
skin draws each row exactly as tall as it is told, or every row after it
lands in the wrong place.

## Loading more as the user scrolls

`onEndReached` is called once the drawn rows reach the last ten, so the
next page loads while the user is still reading. It is called once for
each length of `rows`: a page that answers
with more rows is asked again at the new end, and one that answers with
none, at the true end of the list, is not. `status` is what the bar under
the table says on the page's behalf; without it, the bar counts the rows
the table holds.

**Loading more as you scroll**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Table, useTable, type Column } from '@bh/table';
import { NumberColumn, rowHeightFor, tableRender } from '@bh/ui';

interface Parcel {
  id: string;
  code: string;
  from: string;
  to: string;
  /** In grams. */
  weight: number;
}

const CITIES = ['Lisbon', 'Porto', 'Madrid', 'Seville', 'Rome', 'Turin', 'Tbilisi', 'Batumi'];
const TOTAL = 10_000;
const PAGE = 200;

/** One page of parcels, made up from its place in the list. */
function page(start: number): Parcel[] {
  return Array.from({ length: Math.min(PAGE, TOTAL - start) }, (_, offset) => {
    const i = start + offset;
    return {
      id: String(i),
      code: `PX-${String(100_000 + i * 7)}`,
      from: CITIES[i % CITIES.length] ?? 'Lisbon',
      to: CITIES[(i * 3 + 1) % CITIES.length] ?? 'Porto',
      weight: 120 + ((i * 263) % 9_800),
    };
  });
}

const columns: Column<Parcel>[] = [
  { key: 'code', header: 'Parcel', value: (p) => p.code, width: 140 },
  { key: 'from', header: 'From', value: (p) => p.from, width: 'minmax(120px, 1fr)' },
  { key: 'to', header: 'To', value: (p) => p.to, width: 'minmax(120px, 1fr)' },
  {
    key: 'weight',
    header: 'Weight (g)',
    value: (p) => p.weight,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 130,
  },
];

export function LoadingMoreAsYouScroll() {
  const table = useTable();
  const [parcels, setParcels] = useState(() => page(0));
  const [fetching, setFetching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Called once the last rows come into view. A real page would fetch here;
  // this one makes the next page up after a moment.
  const more = () => {
    if (fetching || parcels.length >= TOTAL) {
      return;
    }
    setFetching(true);
    timer.current = setTimeout(() => {
      setParcels((loaded) => [...loaded, ...page(loaded.length)]);
      setFetching(false);
    }, 600);
  };

  return (
    <div className="h-360 w-full overflow-auto">
      <Table<Parcel>
        {...table}
        columns={columns}
        rows={parcels}
        isLoading={false}
        rowHeight={rowHeightFor('compact')}
        onEndReached={more}
        status={`${parcels.length.toLocaleString()} of ${TOTAL.toLocaleString()} parcels${fetching ? ', loading more…' : ''}`}
        render={tableRender<Parcel>()}
      />
    </div>
  );
}
```

## Loading, empty and failed

The header and the frame always stay; what changes is the body under
them:

- **Loading:** `isLoading` with no rows draws ten skeleton rows, as tall
  as `rowHeight`. With rows it changes nothing.
- **Refreshing:** `isRefreshing` keeps the rows where they are, dimmed,
  with a moving line under the header, so nothing shifts under the
  pointer and an old number reads as old.
- **Empty:** no rows, no error, not loading. `isFiltered` says the
  filters are why, and `onClearFilters` gives that state its button.
  `tableRender({ empty: { title, detail } })` words the plain empty
  state for what the table holds.
- **Failed:** `error` replaces the body with its message, and `onRetry`
  gives it a button. It wins over every other state.

**Table states**

```tsx
import { useState } from 'react';
import { Table, useTable, type Column } from '@bh/table';
import { SegmentedControl, tableRender } from '@bh/ui';

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
];

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, width: 'minmax(180px, 1fr)' },
  { key: 'author', header: 'Author', value: (b) => b.author, width: 220 },
  { key: 'year', header: 'Year', value: (b) => b.year, align: 'right', width: 90 },
];

const STATES = [
  { value: 'rows', label: 'Rows' },
  { value: 'loading', label: 'Loading' },
  { value: 'refreshing', label: 'Refreshing' },
  { value: 'empty', label: 'Empty' },
  { value: 'filtered', label: 'Filtered' },
  { value: 'error', label: 'Error' },
];

// The words for "no rows yet" are the table's own; every other state's are the skin's.
const render = tableRender<Book>({
  empty: { title: 'No books yet', detail: 'Books you add show up here.' },
});

export function TableStates() {
  const table = useTable();
  const [state, setState] = useState('rows');
  const hasRows = state === 'rows' || state === 'refreshing';
  return (
    <div className="flex w-full flex-col gap-12">
      <SegmentedControl
        label="State"
        size="xs"
        options={STATES}
        value={state}
        onChange={setState}
      />
      <div className="h-320 w-full overflow-auto">
        <Table<Book>
          {...table}
          columns={columns}
          rows={hasRows ? BOOKS : []}
          isLoading={state === 'loading'}
          isRefreshing={state === 'refreshing'}
          isFiltered={state === 'filtered'}
          error={
            state === 'error' ? new Error('The library did not answer · retrying in 30s') : null
          }
          // Each state's one action; without them the skin draws no button.
          onRetry={() => setState('rows')}
          onClearFilters={() => setState('rows')}
          render={render}
        />
      </div>
    </div>
  );
}
```

Without `onRetry` or `onClearFilters` the skin draws no button: the
table can't retry a load it never made, or clear filters it never saw.
The totals row shows only beside rows, so it is gone in all four.

## Rules

- Only the rows in view are drawn, and the table is as tall as all of
  them: the page scrolls it.
- A row is exactly as tall as `rowHeight` says, which the skin applies.
- Skeleton rows show only while loading with no rows; a reload with rows
  shows them, dimmed only when `isRefreshing` is given.
- An error wins over loading, and loading over empty.
- In every state the header and the frame stay, and only the body is
  replaced.
- `onEndReached` is called once per length of `rows`.

## Reference

```ts
const ROW_HEIGHT: 40;
```

A data row's height in pixels when the table is given no `rowHeight`.

```ts
rowHeightFor(density: Density): number
```

A row's height in pixels for a density, 42 comfortable or 32 compact: what
`useTable`'s `rowHeight` takes, as `rowHeight={rowHeightFor(density)}`.

| Parameter            | Type      | Default | Description               |
| -------------------- | --------- | ------- | ------------------------- |
| `density` (required) | `Density` |         | How tightly the rows sit. |

Returns `number`.

```ts
tableRender<T>(opts?: { empty?: EmptyCopy }): TableRender<T>
```

`@bh/ui`'s skin for `<Table>`: every render slot, drawn in Instrument's
style. Call it typed by the row, as `render={tableRender<Row>()}`.

| Parameter    | Type                    | Default | Description                                            |
| ------------ | ----------------------- | ------- | ------------------------------------------------------ |
| `opts`       | `{ empty?: EmptyCopy }` | `{}`    | `empty`: what the table says while it has no rows yet. |
| `opts.empty` | `EmptyCopy`             |         |                                                        |

Returns `TableRender<T>`.

```ts
interface EmptyCopy
```

What a caller wants said when its table has nothing in it yet.

Only the un-filtered state takes copy. "Your filters match nothing" is the
same sentence for every table in the app; "No files yet · Upload one to
start" is not, and a page that knows that should not have to hand over a
whole render slot to say it.

| Member             | Type        | Default | Description                                               |
| ------------------ | ----------- | ------- | --------------------------------------------------------- |
| `title` (required) | `string`    |         | The line that says the table is empty: `No files yet`.    |
| `detail`           | `ReactNode` |         | A sentence under it, saying how the first row gets there. |
