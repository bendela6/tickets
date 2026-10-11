---
title: Pinning
summary: Freeze columns to the left or right edge of a table wider than its
  frame, and scroll the rest sideways under them.
order: 9
related: [Widths and resizing, Columns, Writing a skin]
---

[//]: # 'written from pinning.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Pinning

Freeze columns to the left or right edge of a table wider than its frame,
and scroll the rest sideways under them.

## Freezing a column

A column with `pinned: 'left'` or `pinned: 'right'` holds still while
the table scrolls sideways: a left-pinned one where it is with the table
scrolled to its start, a right-pinned one where it is scrolled to its
end. So the left ones come first in `columns` and the right ones last.
Here the order number and the customer stay on the left, the edit button
on the right, and the totals row holds its count under the order column
as the rest goes by:

**Frozen columns**

```tsx
import { Table, sortRows, useTable, type Column } from '@bh/table';
import {
  ActionsColumn,
  BadgeColumn,
  DateColumn,
  NumberColumn,
  tableRender,
  type Tone,
} from '@bh/ui';

interface Order {
  id: string;
  number: number;
  customer: string;
  city: string;
  country: string;
  status: 'paid' | 'packed' | 'shipped' | 'returned';
  items: number;
  subtotal: number;
  shipping: number;
  placed: string;
}

const CUSTOMERS = ['Ana', 'Giorgi', 'Marta', 'Luca', 'Nino', 'Inês', 'Pablo', 'Elena', 'Sofia'];
const PLACES = [
  ['Lisbon', 'Portugal'],
  ['Tbilisi', 'Georgia'],
  ['Porto', 'Portugal'],
  ['Turin', 'Italy'],
  ['Batumi', 'Georgia'],
  ['Seville', 'Spain'],
  ['Milan', 'Italy'],
] as const;
const STATUSES = ['paid', 'packed', 'shipped', 'shipped', 'returned'] as const;

const ORDERS: Order[] = Array.from({ length: 30 }, (_, i) => {
  const [city, country] = PLACES[i % PLACES.length] ?? PLACES[0];
  return {
    id: String(i),
    number: 1042 + i,
    customer: CUSTOMERS[i % CUSTOMERS.length] ?? 'Ana',
    city,
    country,
    status: STATUSES[i % STATUSES.length] ?? 'paid',
    items: (i % 5) + 1,
    subtotal: 18 + ((i * 37) % 160),
    shipping: i % 4 === 0 ? 0 : 4.9,
    placed: new Date(Date.UTC(2026, 8, 30 - i, 10, 30)).toISOString(),
  };
});

const STATUS_TONE: Record<Order['status'], Tone> = {
  paid: 'blue',
  packed: 'yellow',
  shipped: 'green',
  returned: 'gray',
};

const euros = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
const sum = (pick: (order: Order) => number) => ORDERS.reduce((total, o) => total + pick(o), 0);
const money = NumberColumn({ format: 'currency', currency: 'EUR' });

// Every column has a width in pixels: a frozen column's place is the sum of
// the frozen widths beside it.
const columns: Column<Order>[] = [
  {
    key: 'number',
    header: 'Order',
    value: (o) => o.number,
    render: (o) => <span className="font-mono">#{o.number}</span>,
    sortable: true,
    width: 100,
    pinned: 'left',
    footer: `${ORDERS.length} orders`,
  },
  {
    key: 'customer',
    header: 'Customer',
    value: (o) => o.customer,
    sortable: true,
    width: 140,
    pinned: 'left',
  },
  { key: 'city', header: 'City', value: (o) => o.city, sortable: true, width: 140 },
  { key: 'country', header: 'Country', value: (o) => o.country, sortable: true, width: 140 },
  {
    key: 'status',
    header: 'Status',
    value: (o) => o.status,
    as: BadgeColumn<Order['status']>({ tone: (status) => STATUS_TONE[status] }),
    width: 130,
  },
  {
    key: 'items',
    header: 'Items',
    value: (o) => o.items,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 100,
    footer: <span className="font-mono">{sum((o) => o.items)}</span>,
  },
  {
    key: 'subtotal',
    header: 'Subtotal',
    value: (o) => o.subtotal,
    as: money,
    align: 'right',
    sortable: true,
    width: 130,
    footer: <span className="font-mono">{euros.format(sum((o) => o.subtotal))}</span>,
  },
  {
    key: 'shipping',
    header: 'Shipping',
    value: (o) => o.shipping,
    as: money,
    align: 'right',
    width: 120,
    footer: <span className="font-mono">{euros.format(sum((o) => o.shipping))}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    value: (o) => o.subtotal + o.shipping,
    as: money,
    align: 'right',
    sortable: true,
    width: 130,
    footer: <span className="font-mono">{euros.format(sum((o) => o.subtotal + o.shipping))}</span>,
  },
  {
    key: 'placed',
    header: 'Placed',
    value: (o) => o.placed,
    as: DateColumn(),
    sortable: true,
    width: 150,
  },
  {
    key: 'actions',
    header: 'Actions',
    as: ActionsColumn({ items: [{ icon: 'pencil', label: 'Edit order', onClick: () => {} }] }),
    align: 'right',
    width: 80,
    resizable: false,
    pinned: 'right',
  },
];

export function FrozenColumns() {
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

A pinned column needs a width in pixels. The table adds up the widths of
the left-pinned columns to know where the frozen part ends, and a track
such as `minmax(200px, 1fr)` has no such width: it is counted as 160
pixels, and the edge is drawn in the wrong place. Give pinned columns a
number, as every column here has.

`@bh/ui` draws a line where the frozen columns end and a fade where the
columns pass under them, once the table has moved, and a fade at either
side of the frame while there are columns hidden past it.

## Scrolling sideways

The table slides its columns sideways under a clip, rather than scrolling
a box of its own, so the page keeps scrolling it up and down and its
header stays stuck. It moves by:

- a sideways swipe or wheel, or Shift and the wheel;
- the scrollbar docked at its foot, which shows while the pointer is over
  the table, while it moves, and while it is dragged: drag the thumb, or
  click the track to jump;
- the middle button: hold it and drag, or click it and move the pointer
  away, then click again, press Escape or turn the wheel to stop;
- the keyboard: focus moving to a cell out of view brings its column in.

A swipe that would go past either end is left to the page, so the page
still scrolls.

## How it is done

Every column keeps its track in one CSS grid, and every row stays one
grid row, frozen columns included: there are no separate panes to keep
in step. A pinned cell is moved back by exactly as far as the columns
have slid, so it seems not to move. The table works the distance out and
hands it to the skin as a `CellPin` on each header, cell and filter
cell, and as `RowPins` for the totals and skeleton rows, which draw their
own cells; the skin applies it as `position: relative; left`. `pin.edge`
marks the innermost pinned column on each side, the one that borders
the part that scrolls.

## Rules

- A pinned column needs a width in pixels; a track function is counted as 160.
- A left-pinned column holds the place it has at the start of the scroll,
  a right-pinned one the place it has at the end.
- Every kind of row pins the same columns: the header, the filter row,
  the rows, the skeleton and the totals row.
- Pinning never splits the table: one grid, one row per row.
- Only the innermost pinned column on each side is the `edge`.
- A sideways gesture past either end of the table goes to the page.

## Reference

```ts
interface CellPin
```

Where a pinned cell sticks, and how far in. Computed by the engine, which
is the only thing that knows the column order and the current widths.

| Member              | Type                                     | Default | Description                                                                                                                              |
| ------------------- | ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `side` (required)   | `'left' \| 'right'`: `'left'`, `'right'` |         | The edge the column is frozen to: its `pinned`.                                                                                          |
| `offset` (required) | `number`                                 |         | Pixels from that edge — the widths of the pinned columns outside it.                                                                     |
| `shift` (required)  | `number`                                 |         | How far to shift this cell so it appears not to move, in pixels.                                                                         |
| `edge` (required)   | `boolean`                                |         | The innermost pinned column on this side, i.e. the one that borders the scrolling middle. The edge treatment goes here and nowhere else. |

```ts
type RowPins = ReadonlyMap<string, CellPin>;
```

Every pin in one row, keyed by `Column.key`.

The two row-shaped slots that draw their own cells — the loading skeleton
and the totals row — are handed the whole map rather than one `CellPin`,
because the engine makes no per-cell call there to hang one on. It is the
same map `RenderThCtx.pin` and `RenderTdCtx.pin` are dealt single entries
of, so a frozen column either holds still in all four of the table's row
shapes or in none of them.

Empty rather than absent when nothing is pinned: a slot that has to ask
about every column it draws should not first have to ask whether it may ask.

```ts
type ScrollX = 'none' | 'start' | 'middle' | 'end';
```

How far the table is scrolled horizontally.

`none` means it all fits. The other three say which edges have content
hidden beyond them, which is what an edge treatment has to know.

One of `'none'`, `'start'`, `'middle'`, `'end'`.
