---
title: Keyboard focus
summary: Move through the table cell by cell with the arrows, sort from its
  headers, and step into a cell's buttons and out again.
order: 7
related: [Selection, Sorting, Cell renderers]
---

[//]: # 'written from keyboard-focus.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Keyboard focus

Move through the table cell by cell with the arrows, sort from its
headers, and step into a cell's buttons and out again.

## One tab stop

With `onFocusChange` given, as `useTable` gives it, the table is a grid
and its cells are a single stop in the tab order: Tab enters them at one
cell, the arrows move from there, and the next Tab moves on. The buttons
and links inside cells are taken out of the tab order, so a hundred rows
of row actions don't stand between the user and the rest of the page;
Enter steps into them.

Tab into this table, move with the arrows, and go up from the first row
to the headers. Enter on a header sorts; Enter on a cell opens its order;
Enter on Actions steps into its buttons, and Escape steps back out.

**Moving by keyboard**

```tsx
import { useState } from 'react';
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { ActionsColumn, NumberColumn, tableRender } from '@bh/ui';

interface Order {
  id: string;
  number: number;
  customer: string;
  city: string;
  total: number;
}

const ORDERS: Order[] = [
  { id: 'a', number: 1042, customer: 'Ana', city: 'Lisbon', total: 84.5 },
  { id: 'b', number: 1043, customer: 'Giorgi', city: 'Tbilisi', total: 19.9 },
  { id: 'c', number: 1044, customer: 'Marta', city: 'Porto', total: 212 },
  { id: 'd', number: 1045, customer: 'Luca', city: 'Turin', total: 47.25 },
  { id: 'e', number: 1046, customer: 'Nino', city: 'Batumi', total: 32 },
  { id: 'f', number: 1047, customer: 'Inês', city: 'Braga', total: 126.4 },
  { id: 'g', number: 1048, customer: 'Pablo', city: 'Seville', total: 58 },
  { id: 'h', number: 1049, customer: 'Elena', city: 'Valencia', total: 171.6 },
];

export function MovingByKeyboard() {
  const table = useTable();
  const [said, setSaid] = useState('Tab into the table, then use the arrows.');

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Order',
      value: (order) => order.number,
      render: (order) => <span className="font-mono">#{order.number}</span>,
      sortable: true,
      width: 100,
    },
    {
      key: 'customer',
      header: 'Customer',
      value: (order) => order.customer,
      sortable: true,
      width: 'minmax(140px, 1fr)',
    },
    { key: 'city', header: 'City', value: (order) => order.city, sortable: true, width: 130 },
    {
      key: 'total',
      header: 'Total',
      value: (order) => order.total,
      as: NumberColumn({ format: 'currency', currency: 'EUR' }),
      align: 'right',
      sortable: true,
      width: 120,
    },
    {
      key: 'actions',
      header: 'Actions',
      // Enter or F2 on this cell steps into its buttons; Escape steps back out.
      as: ActionsColumn({
        items: [
          {
            icon: 'copy',
            label: 'Copy order number',
            onClick: (row) => setSaid(`Copied #${(row as Order).number}.`),
          },
          {
            icon: 'pencil',
            label: 'Edit order',
            onClick: (row) => setSaid(`Editing #${(row as Order).number}.`),
          },
        ],
      }),
      align: 'right',
      width: 100,
      resizable: false,
    },
  ];

  const focused = table.state.focused;
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-320 w-full overflow-auto">
        <Table<Order>
          {...table}
          columns={columns}
          rows={sortRows(ORDERS, table.state.sort, columns)}
          isLoading={false}
          // Enter on a cell with no button of its own.
          onRowActivate={(order) => setSaid(`Opened #${order.number}.`)}
          render={tableRender<Order>()}
        />
      </div>
      <p className="text-12/17 text-gray-11 font-mono">
        {focused ? `focused: row ${focused.rowIndex}, ${focused.columnKey}. ` : ''}
        {said}
      </p>
    </div>
  );
}
```

## The keys

| Key                       | Does                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                     | Enters the cells at the focused one, else the first; pressed again, moves on.                                                                                                     |
| `←` or `→` or `↑` or `↓`  | Moves one cell. ↑ from the first row reaches the header row.                                                                                                                      |
| `Home` or `End`           | Moves to the first or the last cell in the row.                                                                                                                                   |
| `Ctrl+Home` or `Ctrl+End` | Moves to the first cell of the first row, or the last cell of the last row. Cmd does what Ctrl does.                                                                              |
| `PageUp` or `PageDown`    | Moves a screenful of rows. PageUp stops at the first row, not the header.                                                                                                         |
| `Enter`                   | On a header, sorts as a click does, and Shift+Enter as a shift-click. On a cell with buttons or links, steps into the first. On any other cell, calls onRowActivate with its row. |
| `F2`                      | Steps into the cell's first button or link.                                                                                                                                       |
| `Esc`                     | Steps out of the cell, back to the grid.                                                                                                                                          |
| `Space`                   | Ticks or unticks the focused row, when the table selects. Shift+Space adds the range.                                                                                             |
| `Ctrl+C`                  | Copies the focused cell's text. With @bh/ui's skin, the cell says Copied, or Could not copy, for a moment.                                                                        |
| `Alt+↓`                   | On a header, clicks its headerAccessory.                                                                                                                                          |

## Stepping into a cell

Inside a cell the keys are the controls': Tab walks the cell's buttons,
the arrows go to whatever has focus, and only Escape is the table's,
which it stops there so it doesn't also close a dialog the table sits
in. Clicking a button in a cell steps into that cell too.

A control the table holds outside its cells keeps its own place in the
tab order and its own keys: a filter under the header, the button of an
empty or failed state, a group's band.

## Where focus is

The focused cell is `state.focused`, a `CellRef`: the row's index among
the rows on screen, from 0, and the column's `key`, with `rowIndex: -1`
for the header row. It is `null` until the user first puts focus in the
table, so no ring shows before then, though the first cell is already
the table's tab stop. A click on a cell focuses it too.

Only the rows in view exist, so a key that moves to a row out of view
scrolls it in first, then focuses it. If the user scrolls the focused row
away with the mouse, focus waits on the table and comes back to the cell
when its row does.

`@bh/ui` rings the focused cell however focus got there, and a header
only when it was reached by keyboard: a header is a control, and a click
on it sorts.

## Rules

- Keyboard focus is on only with `onFocusChange`. Without it the table
  leaves the tab order alone, and the controls in its cells stay
  tabbable.
- The cells are one tab stop, and Tab is never trapped in them. A
  control outside the cells keeps its own place in the tab order and its
  own keys.
- Focus is a position: a row's index and a column's key. After a sort it
  stays where it was on screen, and a column keeps it however the
  columns move.
- The header row is row -1, which is how sorting is reached without a
  mouse.
- A key moves to a row out of view by scrolling it in before focusing
  it.

## Reference

```ts
interface CellRef
```

The address of one cell: its row's index and its column's key. The column
is named, so focus stays in it when columns are hidden, moved or pinned;
the row is a position, so after a sort focus stays where it was on screen.

`rowIndex: -1` is the header row: `↑` from the first row reaches the
headers, where Enter sorts.

| Member                 | Type     | Default | Description                                                          |
| ---------------------- | -------- | ------- | -------------------------------------------------------------------- |
| `rowIndex` (required)  | `number` |         | The row's place among the rows on screen, from 0; -1 for the header. |
| `columnKey` (required) | `string` |         | The column's `key`.                                                  |

```ts
interface CellFocusProps
```

What a skin MUST spread onto the element its `th` or `td` slot renders.

`tabIndex` is the roving tab stop — 0 on the focused cell, -1 everywhere
else — and is omitted entirely when the caller has not opted into the focus
model, so a table without it keeps whatever tab behaviour it had.

The two data attributes are how the table finds a cell again after
virtualization has unmounted and remounted its row.

| Member                     | Type     | Default | Description                                                                                              |
| -------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `tabIndex`                 | `number` |         | 0 on the one cell that is the grid's tab stop, -1 on the rest; absent when the table has no focus model. |
| `data-cell-row` (required) | `number` |         | The cell's `CellRef.rowIndex`.                                                                           |
| `data-cell-col` (required) | `string` |         | The cell's `CellRef.columnKey`.                                                                          |
