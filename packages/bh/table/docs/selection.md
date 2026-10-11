---
title: Selection
summary: Let the user tick rows, a range of them or all of them, by mouse or
  keyboard, kept by row id through every sort.
order: 6
related: [Keyboard focus, Columns, useTable]
---

[//]: # 'written from selection.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Selection

Let the user tick rows, a range of them or all of them, by mouse or
keyboard, kept by row id through every sort.

## Turning it on

Selection takes three things: `getRowId`, which names each row; the
`onSelectionChange` that `useTable` already spreads; and a column with
`select: true` for the checkboxes, which the skin draws. The selected ids
are `state.selected`, a `Set`.

**Selecting files**

```tsx
import { useState } from 'react';
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { Button, DateColumn, NumberColumn, TextColumn, tableRender } from '@bh/ui';

interface File {
  id: string;
  name: string;
  /** In kilobytes. */
  size: number;
  modified: string;
}

const FILES: File[] = [
  { id: 'garden-plan', name: 'Garden plan.pdf', size: 482, modified: '2026-09-28T09:12:00Z' },
  { id: 'budget', name: 'Budget 2026.xlsx', size: 96, modified: '2026-09-30T08:05:00Z' },
  { id: 'tram', name: 'Lisbon tram.jpg', size: 3120, modified: '2026-07-02T11:20:00Z' },
  { id: 'recipes', name: 'Recipes.docx', size: 214, modified: '2026-06-19T19:02:00Z' },
  { id: 'backup', name: 'Backup 09-2026.zip', size: 58200, modified: '2026-09-01T02:00:00Z' },
  { id: 'reading', name: 'Reading list.md', size: 6, modified: '2026-09-29T21:44:00Z' },
  { id: 'old-town', name: 'Tbilisi old town.jpg', size: 2870, modified: '2026-05-23T14:31:00Z' },
  { id: 'seeds', name: 'Seed orders.xlsx', size: 41, modified: '2026-03-11T10:15:00Z' },
  { id: 'receipt', name: 'Bike receipt.pdf', size: 133, modified: '2026-04-08T12:47:00Z' },
  { id: 'fonts', name: 'Fonts.zip', size: 12400, modified: '2026-02-17T09:30:00Z' },
  { id: 'bridge', name: 'Porto bridge.jpg', size: 4410, modified: '2026-07-05T18:09:00Z' },
  { id: 'tax', name: 'Tax return 2025.pdf', size: 905, modified: '2026-04-29T15:55:00Z' },
];

const columns: Column<File>[] = [
  // The engine draws this column's checkboxes; it needs no value.
  { key: 'select', header: 'Select', select: true, width: 40, resizable: false },
  {
    key: 'name',
    header: 'Name',
    value: (file) => file.name,
    as: TextColumn(),
    sortable: true,
    width: 'minmax(200px, 1fr)',
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

export function SelectingFiles() {
  const table = useTable();
  const [files, setFiles] = useState(FILES);
  const selected = table.state.selected ?? new Set<string>();

  const archive = () => {
    setFiles(files.filter((file) => !selected.has(file.id)));
    table.onSelectionChange(new Set());
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex h-32 items-center gap-8">
        <span className="text-13/19 text-gray-11 flex-1 font-sans">
          {selected.size === 0 ? 'Nothing selected' : `${selected.size} selected`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => table.onSelectionChange(new Set())}
        >
          Clear
        </Button>
        <Button variant="outline" size="sm" disabled={selected.size === 0} onClick={archive}>
          Archive
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFiles(FILES)}>
          Put back
        </Button>
      </div>
      <div className="h-320 w-full overflow-auto">
        <Table<File>
          {...table}
          // An id, not a position: the selection follows the file through a sort.
          getRowId={(file) => file.id}
          columns={columns}
          rows={sortRows(files, table.state.sort, columns)}
          isLoading={false}
          render={tableRender<File>()}
        />
      </div>
    </div>
  );
}
```

Tick a few files, then sort by size: the ticks go with the files, not
with the places they were in. Archive takes the ticked files out of the
list and clears the selection; Put back brings them all back.

## Ticking rows

- **A row's box** ticks or unticks that row.
- **Shift and a row's box** adds every row between it and the last row
  whose box was clicked without shift (before any, the focused row). A
  range only adds: a row already ticked inside it stays ticked.
- **The header's box** ticks every row the table holds when any is
  unticked, and unticks them all only when every one is ticked. A partly
  ticked table shows it as a dash, and a click completes the selection
  rather than losing it.
- **Space** on a focused row ticks or unticks it, and **Shift+Space**
  adds the range, as shift does with the mouse.

"Every row the table holds" is the rows on screen and those scrolled out
of view, but not the rows a filter has taken out of `rows`, and not those
in a collapsed [group](groups.md). The status bar counts what is
selected, and `@bh/ui` tints the selected rows and marks them
`aria-selected`.

## Doing something with it

The selection is a set of ids, so acting on it is the page's: look the
rows up by id, as Archive does above, and clear it by calling
`onSelectionChange(new Set())`. It is kept until something changes it:
ids of rows that are gone stay in the set until the page clears them.

## Rules

- Selection is keyed on the row's id, never its position: under a sort,
  a filter or a reload, the row at a place is not the row it was.
- Without both `getRowId` and `onSelectionChange` there is no selection
  at all, and Space is left to the browser.
- A shift-click range adds every row in it and removes none.
- The header's box selects everything while anything is unselected, and
  clears only when everything is selected.
- The table never drops ids itself; the page clears what it no longer
  wants.

## Reference

```ts
toggleSelection(selected: ReadonlySet<string>, id: string): Set<string>
```

The selection with one row ticked, or unticked if it was: a click on its box.

| Parameter             | Type                  | Default | Description                              |
| --------------------- | --------------------- | ------- | ---------------------------------------- |
| `selected` (required) | `ReadonlySet<string>` |         | The selected row ids now. Left as it is. |
| `id` (required)       | `string`              |         | The row's id.                            |

Returns `Set<string>`.

```ts
extendSelection(selected: ReadonlySet<string>, ids: string[]): Set<string>
```

The selection with every row of a range added: a shift-click. It never
takes a row out.

| Parameter             | Type                  | Default | Description                              |
| --------------------- | --------------------- | ------- | ---------------------------------------- |
| `selected` (required) | `ReadonlySet<string>` |         | The selected row ids now. Left as it is. |
| `ids` (required)      | `string[]`            |         | The range's row ids.                     |

Returns `Set<string>`.

```ts
toggleAll(selected: ReadonlySet<string>, ids: string[]): Set<string>
```

The selection after a click on the header's box: every row added while any
is missing, and every row taken out only when all of them were in.

| Parameter             | Type                  | Default | Description                                               |
| --------------------- | --------------------- | ------- | --------------------------------------------------------- |
| `selected` (required) | `ReadonlySet<string>` |         | The selected row ids now. Left as it is.                  |
| `ids` (required)      | `string[]`            |         | Every row the table holds. Ids outside it are left alone. |

Returns `Set<string>`.

```ts
selectionOf(selected: ReadonlySet<string>, ids: string[]): { checked: boolean; indeterminate: boolean }
```

How the header's box shows: `checked` when every row is selected,
`indeterminate` when some are, neither when none are or there are no rows.

| Parameter             | Type                  | Default | Description                |
| --------------------- | --------------------- | ------- | -------------------------- |
| `selected` (required) | `ReadonlySet<string>` |         | The selected row ids.      |
| `ids` (required)      | `string[]`            |         | Every row the table holds. |

Returns `{ checked: boolean; indeterminate: boolean }`.

```ts
rangeBetween(a: number, b: number): number[]
```

Every index from one to the other, both included, in either order:
`rangeBetween(5, 2)` is `[2, 3, 4, 5]`.

| Parameter      | Type     | Default | Description |
| -------------- | -------- | ------- | ----------- |
| `a` (required) | `number` |         | One end.    |
| `b` (required) | `number` |         | The other.  |

Returns `number[]`.
