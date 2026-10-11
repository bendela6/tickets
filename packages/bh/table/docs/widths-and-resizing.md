---
title: Widths and resizing
summary: Size each column in pixels or with a flexible track, let the user drag
  or fit it, and save the widths under a key the app names.
order: 5
related: [Columns, useTable, Pinning]
---

[//]: # 'written from widths-and-resizing.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Widths and resizing

Size each column in pixels or with a flexible track, let the user drag or
fit it, and save the widths under a key the app names.

## A column's width

The columns are the tracks of one CSS grid. A column's `width` is a
number of pixels, or a string written into `grid-template-columns` as it
is, so a track function works: `minmax(200px, 1fr)` takes what the fixed
columns leave. A width the user has dragged wins over both, and a column
with neither is 160 pixels wide.

## Dragging and fitting

Every column has a resize handle on its right edge unless it says
`resizable: false`. Dragging it reports the new width through
`onWidthChange` on every move, and `@bh/ui` draws a line down the whole
table where the edge will land, with the width and how far it has moved.
A drag goes no narrower than the column's `minWidth`, or 64 pixels
without one.

Double-click a handle to fit the column to its widest cell, the header's
included, never below its `minWidth`. Only the rows on screen are
measured: a virtualized table has drawn no others.

## Saving them

`useTable({ storageKey })` saves the widths in `localStorage` under
`${storageKey}:widths`, on every change, and reads them back on the next
mount. The app names the key and the table adds nothing to it, so two
apps on one origin never share widths, as long as each names its own.
Drag a column here and reload the page: the widths are where you left
them.

**Saved widths**

```tsx
import { Table, useTable, type Column } from '@bh/table';
import { NumberColumn, TextColumn, tableRender } from '@bh/ui';

interface Plant {
  id: string;
  name: string;
  latin: string;
  light: string;
  /** Days between waterings. */
  water: number;
}

const PLANTS: Plant[] = [
  { id: '1', name: 'Monstera', latin: 'Monstera deliciosa', light: 'Bright, indirect', water: 7 },
  { id: '2', name: 'Snake plant', latin: 'Dracaena trifasciata', light: 'Any', water: 21 },
  { id: '3', name: 'Rosemary', latin: 'Salvia rosmarinus', light: 'Full sun', water: 10 },
  { id: '4', name: 'Peace lily', latin: 'Spathiphyllum wallisii', light: 'Shade', water: 5 },
  { id: '5', name: 'Fiddle-leaf fig', latin: 'Ficus lyrata', light: 'Bright, indirect', water: 8 },
  { id: '6', name: 'Basil', latin: 'Ocimum basilicum', light: 'Full sun', water: 2 },
  { id: '7', name: 'Pothos', latin: 'Epipremnum aureum', light: 'Any', water: 9 },
  { id: '8', name: 'Lavender', latin: 'Lavandula angustifolia', light: 'Full sun', water: 14 },
];

const columns: Column<Plant>[] = [
  // Flexible, and never narrower than 120 however it is dragged.
  {
    key: 'name',
    header: 'Plant',
    value: (p) => p.name,
    width: 'minmax(160px, 1fr)',
    minWidth: 120,
  },
  {
    key: 'latin',
    header: 'Latin name',
    value: (p) => p.latin,
    as: TextColumn({ mono: true }),
    width: 200,
  },
  { key: 'light', header: 'Light', value: (p) => p.light, width: 150 },
  {
    key: 'water',
    header: 'Water every (days)',
    value: (p) => p.water,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 160,
    // Fixed: no handle on this one.
    resizable: false,
  },
];

const STORAGE_KEY = 'docs:plants';

/** What is saved now, read back. Storage may be turned off; then nothing is. */
function saved(): string {
  try {
    return localStorage.getItem(`${STORAGE_KEY}:widths`) ?? 'nothing yet';
  } catch {
    return 'nothing: storage is off';
  }
}

export function SavedWidths() {
  const table = useTable({ storageKey: STORAGE_KEY });
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-280 w-full overflow-auto">
        <Table<Plant>
          {...table}
          columns={columns}
          rows={PLANTS}
          isLoading={false}
          render={tableRender<Plant>()}
        />
      </div>
      <code className="text-12/17 text-gray-11 font-mono">
        {STORAGE_KEY}:widths = {saved()}
      </code>
    </div>
  );
}
```

Without a `storageKey` the widths live as long as the table does, which
suits a demo, a test, or a table drawn once in a dialog. A saved entry
that isn't JSON, or a storage that is turned off or full, is treated as
empty: the columns still resize, and nothing is remembered.

## Without useTable

`useTableWidths(storageKey)` is the widths half of `useTable` on its own:
`[widths, setWidth]`, for `state.widths` and `onWidthChange`.
`useColumnResize` is the drag behind a handle, for a skin that draws its
own ([Writing a skin](writing-a-skin.md)): spread its handlers onto
the handle, and it reports a width as the pointer moves. It measures the
header cell when the drag starts, so a flexible column moves from the
width it has, not from the 160 a track function falls back to.

## Rules

- A column's width is its dragged width, else its `width`, else 160
  pixels.
- Every column can be resized unless it says `resizable: false`.
- Widths are saved under `${storageKey}:widths`, exactly the key the app
  gives plus `:widths`; no key, no saving.
- Widths are written on every change, with no delay, and a corrupt or
  unreadable entry is read as none.
- A drag starts from the width the cell has when it is grabbed, so one
  drag after another never drifts.

## Reference

```ts
useTableWidths(storageKey?: string | null): readonly [Record<string, number>, (k: string, px: number) => void]
```

Column widths, saved per table under `${storageKey}:widths`: the state a
`<Table>` takes as `state.widths`, and the setter it takes as
`onWidthChange`.

Without a `storageKey` the widths live as long as the component. A storage
that can't be read or written (turned off, or full) is treated as empty.

| Parameter    | Type             | Default | Description                                           |
| ------------ | ---------------- | ------- | ----------------------------------------------------- |
| `storageKey` | `string \| null` |         | The app's name for this table, such as `shop:orders`. |

Returns `readonly [Record<string, number>, (k: string, px: number) => void]`: The widths by column key, and a setter taking a key and a width.

```ts
useColumnResize(opts: UseColumnResizeOptions): UseColumnResizeHandlers
```

The drag behind a column's resize handle: spread what it returns onto the
handle, and `onChange` is called with the width as the pointer moves. The
drag starts from the header cell's measured width, and goes no narrower
than `minWidth`.

| Parameter                    | Type                     | Default | Description                                                                                                                                   |
| ---------------------------- | ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `opts` (required)            | `UseColumnResizeOptions` |         | The width to start from, the floor, and where widths go.                                                                                      |
| `opts.startWidth` (required) | `number`                 |         | The width to drag from when the handle's cell can't be measured. Inside a header cell carrying `data-cell-col`, the cell is measured instead. |
| `opts.minWidth`              | `number`                 |         | The narrowest the drag goes, in pixels: 64 without one.                                                                                       |
| `opts.onChange` (required)   | `(px: number) => void`   |         | Called with the new width on every pointer move of a drag.                                                                                    |

Returns `UseColumnResizeHandlers`.

```ts
interface UseColumnResizeOptions
```

`useColumnResize`'s options: the width a drag starts from, its floor, and
where the widths go.

| Member                  | Type                   | Default | Description                                                                                                                                   |
| ----------------------- | ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `startWidth` (required) | `number`               |         | The width to drag from when the handle's cell can't be measured. Inside a header cell carrying `data-cell-col`, the cell is measured instead. |
| `minWidth`              | `number`               |         | The narrowest the drag goes, in pixels: 64 without one.                                                                                       |
| `onChange` (required)   | `(px: number) => void` |         | Called with the new width on every pointer move of a drag.                                                                                    |

```ts
interface UseColumnResizeHandlers
```

Pointer handlers to spread onto a resize handle.

| Member                     | Type                                          | Default | Description                                                          |
| -------------------------- | --------------------------------------------- | ------- | -------------------------------------------------------------------- |
| `onPointerDown` (required) | `(e: ReactPointerEvent<HTMLElement>) => void` |         | Starts a drag: captures the pointer and measures the starting width. |
| `onPointerMove` (required) | `(e: ReactPointerEvent<HTMLElement>) => void` |         | Reports the width the drag has reached, while one is running.        |
| `onPointerUp` (required)   | `(e: ReactPointerEvent<HTMLElement>) => void` |         | Ends the drag.                                                       |
