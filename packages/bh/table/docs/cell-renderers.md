---
title: Cell renderers
summary: Draw a column's values as text, numbers, dates, badges, links, pictures
  or row actions with @bh/ui's renderers, or write your own.
order: 11
related: [Columns, Keyboard focus, Writing a skin]
---

[//]: # 'written from cell-renderers.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Cell renderers

Draw a column's values as text, numbers, dates, badges, links, pictures
or row actions with `@bh/ui`'s renderers, or write your own.

## Import

```tsx
import {
  ActionsColumn,
  BadgeColumn,
  DateColumn,
  ImageColumn,
  LinkColumn,
  NumberColumn,
  TextColumn,
} from '@bh/ui';
```

## The renderers

Each is a function you call once, where the column is written, with its
options, and it returns the column's `as`: `as: NumberColumn({ format:
'currency', currency: 'EUR' })`. The table hands it each cell's
`value(row)` and the row.

**Every renderer**

```tsx
import { useState } from 'react';
import { Table, useTable, type Column } from '@bh/table';
import {
  ActionsColumn,
  BadgeColumn,
  DateColumn,
  ImageColumn,
  LinkColumn,
  NumberColumn,
  TextColumn,
  tableRender,
} from '@bh/ui';

interface Member {
  id: string;
  name: string;
  /** A picture, or none: then an avatar from the name. */
  photo: string | null;
  card: string;
  plan: 'reader' | 'family' | 'student';
  borrowed: number;
  fees: number;
  joined: string;
  visited: string;
}

/** A drawn square rather than a picture from elsewhere: the example needs no network. */
const SWATCH =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%2330a46c"/></svg>';

const MEMBERS: Member[] = [
  {
    id: 'ana',
    name: 'Ana',
    photo: SWATCH,
    card: 'C-0142',
    plan: 'reader',
    borrowed: 41,
    fees: 0,
    joined: '2023-02-11T10:00:00Z',
    visited: '2026-09-29T16:20:00Z',
  },
  {
    id: 'giorgi',
    name: 'Giorgi',
    photo: null,
    card: 'C-0187',
    plan: 'family',
    borrowed: 112,
    fees: 2.5,
    joined: '2021-06-03T10:00:00Z',
    visited: '2026-09-30T11:05:00Z',
  },
  {
    id: 'marta',
    name: 'Marta',
    photo: null,
    card: 'C-0203',
    plan: 'student',
    borrowed: 17,
    fees: 0,
    joined: '2025-09-15T10:00:00Z',
    visited: '2026-08-21T09:40:00Z',
  },
  {
    id: 'luca',
    name: 'Luca',
    photo: SWATCH,
    card: 'C-0219',
    plan: 'reader',
    borrowed: 8,
    fees: 6,
    joined: '2026-01-20T10:00:00Z',
    visited: '2026-06-02T18:15:00Z',
  },
  {
    id: 'nino',
    name: 'Nino',
    photo: null,
    card: 'C-0230',
    plan: 'family',
    borrowed: 64,
    fees: 0,
    joined: '2022-11-30T10:00:00Z',
    visited: '2026-09-27T13:30:00Z',
  },
];

const PLAN_LABEL: Record<Member['plan'], string> = {
  reader: 'Reader',
  family: 'Family',
  student: 'Student',
};

export function EveryRenderer() {
  const table = useTable();
  const [said, setSaid] = useState('');

  const columns: Column<Member>[] = [
    {
      key: 'photo',
      header: 'Photo',
      value: (m) => m.photo,
      as: ImageColumn({ fallback: (row) => (row as Member).name }),
      width: 72,
      resizable: false,
    },
    {
      key: 'name',
      header: 'Name',
      value: (m) => m.name,
      as: LinkColumn({ href: (row) => `#member-${(row as Member).id}` }),
      width: 'minmax(120px, 1fr)',
    },
    {
      key: 'card',
      header: 'Card',
      value: (m) => m.card,
      as: TextColumn({ mono: true }),
      width: 100,
    },
    {
      key: 'plan',
      header: 'Plan',
      value: (m) => m.plan,
      as: BadgeColumn<Member['plan']>({
        tone: (plan) => (plan === 'family' ? 'purple' : plan === 'student' ? 'teal' : 'blue'),
        label: (plan) => PLAN_LABEL[plan],
      }),
      width: 110,
    },
    {
      key: 'borrowed',
      header: 'Borrowed',
      value: (m) => m.borrowed,
      as: NumberColumn({ format: 'integer' }),
      align: 'right',
      width: 110,
    },
    {
      key: 'fees',
      header: 'Fees',
      value: (m) => m.fees,
      as: NumberColumn({ format: 'currency', currency: 'EUR' }),
      align: 'right',
      width: 100,
    },
    {
      key: 'joined',
      header: 'Joined',
      value: (m) => m.joined,
      as: DateColumn({ style: 'absolute' }),
      width: 190,
    },
    { key: 'visited', header: 'Last visit', value: (m) => m.visited, as: DateColumn(), width: 130 },
    {
      key: 'actions',
      header: 'Actions',
      as: ActionsColumn({
        items: [
          {
            icon: 'pencil',
            label: 'Edit member',
            onClick: (row) => setSaid(`Edit ${(row as Member).name}`),
          },
          {
            icon: 'trash',
            label: 'Remove member',
            tone: 'danger',
            onClick: (row) => setSaid(`Remove ${(row as Member).name}`),
          },
        ],
      }),
      align: 'right',
      width: 100,
      resizable: false,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-320 w-full overflow-auto">
        <Table<Member>
          {...table}
          columns={columns}
          rows={MEMBERS}
          isLoading={false}
          render={tableRender<Member>()}
        />
      </div>
      <p className="text-12/17 text-gray-11 h-17 font-mono">{said}</p>
    </div>
  );
}
```

- **`TextColumn`** keeps the text on one line and fades it out where it
  runs past the column. Only then does its cell have a
  [Tooltip](../../ui/src/library/overlays/components/tooltip/tooltip.md) with the whole of it, under
  the row, shown on hover or when the cell has keyboard focus
  ([useIsClipped](../../hooks/docs/use-is-clipped.md) says when). `mono` sets it in
  the mono face, the tooltip too; `truncate: false` lets it wrap,
  beside a `rowHeight` that leaves room.
- **`NumberColumn`** right-aligns digits that line up: `integer`,
  `decimal` (up to six places, or `fractionDigits`), or `currency` with a
  `currency` code. Give its column `align: 'right'`, which puts the cell
  and its footer on the right.
- **`DateColumn`** says how long ago (`relative`, the default) or the
  date and time in full (`absolute`), from an ISO string or a `Date`.
- **`BadgeColumn`** draws the value as a pill, its `tone` from the value,
  its words from `label`, else the value itself.
- **`LinkColumn`** links the value to `href(row)`, opening a new tab with
  `external`.
- **`ImageColumn`** draws the picture at the value's address, named by
  `fallback(row)`, and an avatar from that name when there is none.
- **`ActionsColumn`** draws an icon-only Button for each item, named by
  its `label`, which is also its tooltip, and coloured by its `tone`, shown while the row is hovered or a
  button has keyboard focus. Its column needs no `value`: each item's
  `onClick` is handed the row.

A missing value draws a dash in the number and date columns, nothing in
the text and badge columns, and the avatar in the picture column. A
link's or an action's click stays its own: it doesn't
reach the row's `onRowClick` behind it. Links and action buttons are out
of the tab order, like everything in a cell, and Enter on the cell steps
into them ([Keyboard focus](keyboard-focus.md)).

## A renderer of your own

A renderer is a function from `{ value, row }` to what the cell shows.
Wrap it in one that takes the options, as `@bh/ui`'s do, and the column
reads the same as theirs. This one draws the copies left as a bar, beside
the number that says it:

**A renderer of your own**

```tsx
import { Table, useTable, type Column, type Renderer } from '@bh/table';
import { cn, tableRender } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  stock: number;
}

const BOOKS: Book[] = [
  { id: '1', title: 'Invisible Cities', stock: 12 },
  { id: '2', title: 'Blindness', stock: 3 },
  { id: '3', title: 'The Book of Disquiet', stock: 0 },
  { id: '4', title: 'The Leopard', stock: 7 },
  { id: '5', title: 'The Name of the Rose', stock: 20 },
];

/**
 * A bar for how many copies are left, out of `full`. Like @bh/ui's helpers,
 * it is called once, where the column is written, and returns the renderer.
 */
function StockColumn(full: number): Renderer<number> {
  return ({ value }) => {
    const share = Math.min(1, value / full);
    return (
      <span className="flex w-full items-center gap-8">
        {/* The number says it; the bar only shows it. */}
        <span aria-hidden className="bg-gray-4 rounded-2 h-6 flex-1">
          <span
            className={cn('rounded-2 block h-6', value < 5 ? 'bg-orange-9' : 'bg-green-9')}
            style={{ width: `${share * 100}%` }}
          />
        </span>
        <span className="text-12/17 w-24 text-right font-mono tabular-nums">{value}</span>
      </span>
    );
  };
}

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, width: 'minmax(180px, 1fr)' },
  { key: 'stock', header: 'In stock', value: (b) => b.stock, as: StockColumn(20), width: 200 },
];

export function ARendererOfYourOwn() {
  const table = useTable();
  return (
    <div className="h-280 w-full overflow-auto">
      <Table<Book>
        {...table}
        columns={columns}
        rows={BOOKS}
        isLoading={false}
        render={tableRender<Book>()}
      />
    </div>
  );
}
```

For a cell that needs more of the row than one value, `render(row)` on
the column does the same without a value at all.

## Rules

- A renderer is made once, where the column is written, and called for
  every cell.
- A missing value draws a dash in `NumberColumn` and `DateColumn`,
  nothing in `TextColumn` and `BadgeColumn`, and the avatar in
  `ImageColumn`.
- A click on a link or an action never also clicks the row.
- A renderer's buttons and links leave the tab order to the table: Enter
  on the cell reaches them.

## Reference

```ts
TextColumn(opts?: TextColumnOpts): Renderer<string | null | undefined>
```

A cell of text, on one line, faded where it runs past the column, with the
whole of it in a tooltip on hover or keyboard focus while it is clipped. An
empty value draws nothing.

| Parameter       | Type                                                             | Default | Description                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opts`          | `TextColumnOpts`                                                 | `{}`    |                                                                                                                                                                             |
| `opts.mono`     | `boolean`                                                        |         | Sets the value in the mono face, at 12 pixels: ids, codes, paths.                                                                                                           |
| `opts.truncate` | `boolean`                                                        |         | Keep the value on one line, fading it out where it runs past the column and offering the whole of it, in a tooltip under the row, on hover or keyboard focus. Default true. |
| `opts.align`    | `'left' \| 'right' \| 'center'`: `'left'`, `'right'`, `'center'` |         | Follows the column's own alignment, so a right-aligned value fades at the end it actually runs off.                                                                         |

Returns `Renderer<string \| null \| undefined>`.

```ts
NumberColumn(opts?: NumberColumnOpts): Renderer<number | string | null>
```

A cell of a number, right-aligned in the mono face with digits of one
width, in the reader's locale. A missing or unreadable value is a dash.

| Parameter             | Type                                                                           | Default | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| `opts`                | `NumberColumnOpts`                                                             | `{}`    |                                                                                                         |
| `opts.format`         | `'integer' \| 'decimal' \| 'currency'`: `'integer'`, `'decimal'`, `'currency'` |         | How the number is written: whole, with decimals as it has them, or as money. `decimal` by default.      |
| `opts.currency`       | `string`                                                                       |         | The ISO currency code `currency` writes in, such as `EUR`; without one, it writes a decimal.            |
| `opts.fractionDigits` | `number`                                                                       |         | The digits after the point: exactly this many as money (2 by default), at least this many as a decimal. |

Returns `Renderer<number \| string \| null>`.

```ts
DateColumn(opts?: DateColumnOpts): Renderer<string | Date | null | undefined>
```

A cell of a date or an ISO date string, written as a time ago or in full,
with the exact moment on hover. A missing or unreadable date is a dash.

| Parameter    | Type                                                   | Default | Description                                                                   |
| ------------ | ------------------------------------------------------ | ------- | ----------------------------------------------------------------------------- |
| `opts`       | `DateColumnOpts`                                       | `{}`    |                                                                               |
| `opts.style` | `'relative' \| 'absolute'`: `'relative'`, `'absolute'` |         | `relative` ("3 days ago", the default) or `absolute`, in the reader's locale. |

Returns `Renderer<string \| Date \| null \| undefined>`.

```ts
BadgeColumn<V>(opts: BadgeColumnOpts<V>): Renderer<V>
```

A cell that is a small Pill, its tone and text from the value. An empty value draws nothing.

| Parameter              | Type                   | Default | Description                                                             |
| ---------------------- | ---------------------- | ------- | ----------------------------------------------------------------------- |
| `opts` (required)      | `BadgeColumnOpts<V>`   |         |                                                                         |
| `opts.tone` (required) | `(value: V) => Tone`   |         | The pill's tone for a value: a role or a hue by name.                   |
| `opts.label`           | `(value: V) => string` |         | The pill's text for a value; the value itself, as a string, by default. |

Returns `Renderer<V>`.

```ts
LinkColumn(opts: LinkColumnOpts): Renderer<string | null | undefined>
```

A cell that is a link: the value as its text, to the address `href` gives
for the row. An empty value draws nothing. The link is not a tab stop: Enter
on the focused cell steps into it.

| Parameter              | Type                       | Default | Description                                                    |
| ---------------------- | -------------------------- | ------- | -------------------------------------------------------------- |
| `opts` (required)      | `LinkColumnOpts`           |         |                                                                |
| `opts.href` (required) | `(row: unknown) => string` |         | The address of a row's link, from its row.                     |
| `opts.external`        | `boolean`                  |         | Opens the link in a new tab, with `rel="noopener noreferrer"`. |

Returns `Renderer<string \| null \| undefined>`.

```ts
ImageColumn(opts?: ImageColumnOpts): Renderer<string | null | undefined>
```

Falls back to Avatar rather than hand-rolling an initial disc, so a row
thumbnail and the same person's avatar elsewhere look identical.

| Parameter       | Type                                    | Default | Description                                                      |
| --------------- | --------------------------------------- | ------- | ---------------------------------------------------------------- |
| `opts`          | `ImageColumnOpts`                       | `{}`    |                                                                  |
| `opts.fallback` | `(row: unknown) => string \| undefined` |         | Derives the name an Avatar falls back to when there is no image. |

Returns `Renderer<string \| null \| undefined>`.

```ts
ActionsColumn(opts: ActionsColumnOpts): Renderer<unknown>
```

A cell of icon buttons, one per action, shown while the row is hovered or
a button has focus. Enter on the focused cell steps into them.

| Parameter               | Type                | Default | Description                               |
| ----------------------- | ------------------- | ------- | ----------------------------------------- |
| `opts` (required)       | `ActionsColumnOpts` |         |                                           |
| `opts.items` (required) | `ActionItem[]`      |         | The buttons, in order, at the cell's end. |

Returns `Renderer<unknown>`.
