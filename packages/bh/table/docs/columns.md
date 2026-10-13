---
title: Columns
summary: Say what each column shows, how its cells are drawn, and what it adds
  to the header and the foot of the table.
order: 2
related: [Cell renderers, Sorting, Widths and resizing]
---

[//]: # 'written from columns.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Columns

Say what each column shows, how its cells are drawn, and what it adds to
the header and the foot of the table.

## A column

A `Column<Row>` names itself with a `key`, unique in the table, and its
header with `header`. Its cells come from one of three:

- **`render(row)`**: draws the cell from the row, any way you like.
- **`as`**: a [renderer](cell-renderers.md), handed
  `{ value, row }`, where `value` is the column's `value(row)`.
  `@bh/ui`'s `NumberColumn()`, `BadgeColumn()` and the rest are these.
- **`value(row)`** alone: drawn as text.

`render` wins over `as`, and `as` over the plain value. `value` is also
what [sorting](sorting.md) compares, so a column drawn with `render`
still sorts by its `value`: here the order number is drawn with a `#`
and sorted as a number.

**Orders**

```tsx
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { BadgeColumn, NumberColumn, TextColumn, tableRender, type Tone } from '@bh/ui';

interface Order {
  id: string;
  number: number;
  customer: string;
  city: string;
  status: 'paid' | 'packed' | 'shipped' | 'returned';
  items: number;
  total: number;
}

const ORDERS: Order[] = [
  {
    id: 'a',
    number: 1042,
    customer: 'Ana',
    city: 'Lisbon',
    status: 'shipped',
    items: 3,
    total: 84.5,
  },
  {
    id: 'b',
    number: 1043,
    customer: 'Giorgi',
    city: 'Tbilisi',
    status: 'packed',
    items: 1,
    total: 19.9,
  },
  { id: 'c', number: 1044, customer: 'Marta', city: 'Porto', status: 'paid', items: 6, total: 212 },
  {
    id: 'd',
    number: 1045,
    customer: 'Luca',
    city: 'Turin',
    status: 'shipped',
    items: 2,
    total: 47.25,
  },
  {
    id: 'e',
    number: 1046,
    customer: 'Nino',
    city: 'Batumi',
    status: 'returned',
    items: 1,
    total: 32,
  },
  {
    id: 'f',
    number: 1047,
    customer: 'Inês',
    city: 'Braga',
    status: 'paid',
    items: 4,
    total: 126.4,
  },
  {
    id: 'g',
    number: 1048,
    customer: 'Pablo',
    city: 'Seville',
    status: 'shipped',
    items: 2,
    total: 58,
  },
  {
    id: 'h',
    number: 1049,
    customer: 'Elena',
    city: 'Valencia',
    status: 'packed',
    items: 5,
    total: 171.6,
  },
  {
    id: 'i',
    number: 1050,
    customer: 'Sofia',
    city: 'Milan',
    status: 'shipped',
    items: 1,
    total: 24.99,
  },
  {
    id: 'j',
    number: 1051,
    customer: 'Davit',
    city: 'Kutaisi',
    status: 'paid',
    items: 3,
    total: 66.3,
  },
];

const STATUS_TONE: Record<Order['status'], Tone> = {
  paid: 'blue',
  packed: 'yellow',
  shipped: 'green',
  returned: 'gray',
};

const euros = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
const itemCount = ORDERS.reduce((sum, order) => sum + order.items, 0);
const revenue = ORDERS.reduce((sum, order) => sum + order.total, 0);

const columns: Column<Order>[] = [
  {
    key: 'number',
    header: 'Order',
    // `value` sorts it; `render` draws it.
    value: (order) => order.number,
    render: (order) => <span className="font-mono">#{order.number}</span>,
    sortable: true,
    width: 96,
    resizable: false,
  },
  {
    key: 'customer',
    header: 'Customer',
    value: (order) => order.customer,
    as: TextColumn(),
    sortable: true,
    width: 'minmax(140px, 1fr)',
    minWidth: 120,
    footer: `${ORDERS.length} orders`,
  },
  // No `as` and no `render`: the value is drawn as text.
  { key: 'city', header: 'City', value: (order) => order.city, sortable: true, width: 130 },
  {
    key: 'status',
    header: 'Status',
    value: (order) => order.status,
    as: BadgeColumn<Order['status']>({ tone: (status) => STATUS_TONE[status] }),
    width: 120,
  },
  {
    key: 'items',
    header: 'Items',
    value: (order) => order.items,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 90,
    footer: <span className="font-mono">{itemCount}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    value: (order) => order.total,
    as: NumberColumn({ format: 'currency', currency: 'EUR' }),
    align: 'right',
    sortable: true,
    width: 120,
    footer: <span className="font-mono">{euros.format(revenue)}</span>,
  },
];

export function Orders() {
  const table = useTable();
  return (
    <div className="h-360 w-full overflow-auto">
      <Table<Order>
        {...table}
        columns={columns}
        rows={sortRows(ORDERS, table.state.sort, columns)}
        isLoading={false}
        render={tableRender<Order>()}
      />
    </div>
  );
}
```

`align` places the cells' content (`right` for numbers), and the skin
applies it to the column's cells; `@bh/ui` keeps every header label at
the left. `width`, `minWidth` and `resizable` size the column
([Widths and resizing](widths-and-resizing.md)), `sortable` lets a
header click sort by it, and `pinned` freezes it to an edge
([Pinning](pinning.md)).

## A totals row

A column's `footer` is its cell in a row pinned to the bottom of the
table, above the status bar. The row appears as soon as one column has a
footer, and the others leave theirs blank. It is a finished node, not a
sum the table works out: the page knows what its numbers mean, and how
many rows exist beyond the ones loaded. Above, the customer column
counts the orders and the last two add them up.

The totals row shows only beside rows: not while the table loads with
none, not when it is empty, and not when it failed.

## Filters under the header

A column's `filter` is its cell in a row under the header, which sticks
with it. The row appears once one column has a filter; the table only
places the controls, and the page holds what they say and filters the
rows. A column's `headerAccessory` sits in its header cell after the
label: a click on it never sorts, and Alt+↓ on the focused header clicks
it. Here the funnel keeps the cities over a million.

**Filters under the header**

```tsx
import { useState } from 'react';
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { Button, Combobox, Icon, Input, NumberColumn, tableRender } from '@bh/ui';

interface City {
  id: string;
  name: string;
  country: string;
  population: number;
}

const CITIES: City[] = [
  { id: '1', name: 'Lisbon', country: 'Portugal', population: 545_000 },
  { id: '2', name: 'Porto', country: 'Portugal', population: 232_000 },
  { id: '3', name: 'Braga', country: 'Portugal', population: 193_000 },
  { id: '4', name: 'Madrid', country: 'Spain', population: 3_332_000 },
  { id: '5', name: 'Barcelona', country: 'Spain', population: 1_620_000 },
  { id: '6', name: 'Valencia', country: 'Spain', population: 792_000 },
  { id: '7', name: 'Seville', country: 'Spain', population: 684_000 },
  { id: '8', name: 'Rome', country: 'Italy', population: 2_761_000 },
  { id: '9', name: 'Milan', country: 'Italy', population: 1_372_000 },
  { id: '10', name: 'Turin', country: 'Italy', population: 848_000 },
  { id: '11', name: 'Tbilisi', country: 'Georgia', population: 1_202_000 },
  { id: '12', name: 'Batumi', country: 'Georgia', population: 169_000 },
  { id: '13', name: 'Kutaisi', country: 'Georgia', population: 131_000 },
];

const COUNTRIES = [
  { value: '', label: 'Any country' },
  ...['Georgia', 'Italy', 'Portugal', 'Spain'].map((country) => {
    return { value: country, label: country };
  }),
];

export function FiltersUnderTheHeader() {
  const table = useTable();
  // The page owns the filters: the table only shows where they sit.
  const [name, setName] = useState('');
  const [country, setCountry] = useState<string | null>('');
  const [large, setLarge] = useState(false);

  const columns: Column<City>[] = [
    {
      key: 'name',
      header: 'City',
      value: (city) => city.name,
      sortable: true,
      width: 'minmax(160px, 1fr)',
      filter: (
        <Input
          size="xs"
          className="w-full"
          aria-label="Filter cities"
          placeholder="Name contains…"
          value={name}
          onChange={setName}
        />
      ),
    },
    {
      key: 'country',
      header: 'Country',
      value: (city) => city.country,
      sortable: true,
      width: 160,
      filter: (
        <Combobox
          searchable={false}
          size="xs"
          className="w-full"
          aria-label="Filter countries"
          value={country}
          onChange={setCountry}
          options={COUNTRIES}
        />
      ),
    },
    {
      key: 'population',
      header: 'Population',
      value: (city) => city.population,
      as: NumberColumn({ format: 'integer' }),
      align: 'right',
      sortable: true,
      width: 170,
      // A click on it never sorts; Alt+↓ on the focused header clicks it.
      headerAccessory: (
        <Button
          variant="ghost"
          size="sm"
          tone={large ? 'primary' : 'neutral'}
          aria-label="Only cities over a million"
          aria-pressed={large}
          className="h-24 w-24 p-0"
          onClick={() => setLarge(!large)}
        >
          <Icon name="filter" size="sm" />
        </Button>
      ),
    },
  ];

  const rows = CITIES.filter((city) => {
    return (
      city.name.toLowerCase().includes(name.trim().toLowerCase()) &&
      (!country || city.country === country) &&
      (!large || city.population > 1_000_000)
    );
  });
  const clear = () => {
    setName('');
    setCountry('');
    setLarge(false);
  };

  return (
    <div className="h-360 w-full overflow-auto">
      <Table<City>
        {...table}
        columns={columns}
        rows={sortRows(rows, table.state.sort, columns)}
        isLoading={false}
        isFiltered={rows.length < CITIES.length}
        onClearFilters={clear}
        render={tableRender<City>()}
      />
    </div>
  );
}
```

`isFiltered` tells the table that the filters are why it has no rows, and
`onClearFilters` gives that state its button: filter for a city that
isn't there to see it.

## The checkbox column

A column with `select: true` holds each row's checkbox, and the header's
select-all box; the table draws them and ignores the column's `value`,
`render` and `as`. It needs a row id: see
[Selection](selection.md).

## Rules

- A cell draws `render(row)`, else `as({ value: value(row), row })`, else
  `value(row)` as text, and nothing when there is none of them.
- A column's `key` names it everywhere: in the sort, the saved widths, the
  focused cell and the pins.
- Hiding or moving a column is the page's: pass the columns it wants, in
  its order. Focus and widths follow the key.
- The totals row and the filter row each appear when one column has a
  `footer` or a `filter`, and are blank under the rest.
- The totals row shows only while there are rows.

## Reference

```ts
interface Column<T>
```

One column: what its header says, how a cell is drawn from a row, and how
the column sorts, sizes and sticks. A cell draws `render(row)`, else
`as({ value: value(row), row })`, else `value(row)` as text.

| Member              | Type                                                             | Default | Description                                                                                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key` (required)    | `string`                                                         |         | Names the column in the sort, the widths, the focused cell and the pins. Unique within the table.                                                                                                                                                                                                                    |
| `header` (required) | `string`                                                         |         | The header cell's label.                                                                                                                                                                                                                                                                                             |
| `value`             | `(row: T) => unknown`                                            |         | The cell's value for a row: what `sortRows` compares, what `as` is handed, and what is drawn as text when there is neither `render` nor `as`.                                                                                                                                                                        |
| `render`            | `(row: T) => ReactNode`                                          |         | Draws the cell from the row. Wins over `as` and `value`.                                                                                                                                                                                                                                                             |
| `as`                | `Renderer<any>`                                                  |         | Draws the cell from `{ value, row }`, `value` being `value(row)`: a `Renderer`, such as `@bh/ui`'s `NumberColumn()`.                                                                                                                                                                                                 |
| `sortable`          | `boolean`                                                        |         | A header click sorts by this column. The table reports the sort through `onSortChange`; ordering the rows is the caller's.                                                                                                                                                                                           |
| `width`             | `number \| string`                                               |         | Track size for this column. A number is pixels. A string is emitted into grid-template-columns verbatim, so `minmax(240px, 1fr)` and other track functions work — a flexible column cannot be expressed as a number. A width the user has dragged always wins over both, and 160 pixels is the width without either. |
| `minWidth`          | `number`                                                         |         | The narrowest a drag or a double-click fit may make the column, in pixels. A drag stops at 64 without one.                                                                                                                                                                                                           |
| `align`             | `'left' \| 'right' \| 'center'`: `'left'`, `'right'`, `'center'` |         | Where the cells' content sits. The skin applies it.                                                                                                                                                                                                                                                                  |
| `resizable`         | `boolean`                                                        |         | `false` takes the column's resize handle away. Every other column can be resized.                                                                                                                                                                                                                                    |
| `footer`            | `ReactNode`                                                      |         | This column's cell in the totals row pinned to the bottom of the table. A footer row appears as soon as any column defines one; columns that do not simply leave their cell blank.                                                                                                                                   |
| `filter`            | `ReactNode`                                                      |         | This column's cell in the filter row, drawn directly under the column header. The row appears as soon as any column defines one (and the render set has a `filterRow` slot); columns that do not leave their cell blank.                                                                                             |
| `headerAccessory`   | `ReactNode`                                                      |         | Drawn in this column's header cell, after the label — a filter funnel.                                                                                                                                                                                                                                               |
| `select`            | `boolean`                                                        |         | The row-selection checkbox column. The engine owns this column's content — `value`, `render` and `as` are ignored — because only the engine knows which rows are selected, and the checkbox itself is drawn by the render set's `selectCell` slot so no glyph leaks into the engine.                                 |
| `pinned`            | `'left' \| 'right'`: `'left'`, `'right'`                         |         | Freeze this column against the horizontal scroll.                                                                                                                                                                                                                                                                    |

```ts
type Renderer<V = unknown> = (props: { value: V; row: unknown }) => ReactNode;
```

Draws a cell from its value and its row: what a column's `as` takes.
`@bh/ui`'s column helpers (`TextColumn()`, `NumberColumn()`, ...) each
return one.
