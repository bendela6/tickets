---
title: Groups
summary: Draw the rows in bands under headers of their own, collapse a band, and
  keep the band in view pinned under the column header.
order: 8
related: [Virtualization and states, Selection, useTable]
---

[//]: # 'written from groups.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Groups

Draw the rows in bands under headers of their own, collapse a band, and
keep the band in view pinned under the column header.

## Grouping rows

Pass `groups` instead of `rows`: a list of `TableGroup`s, each a `key`, a
`header` to draw in its band, and its `rows`. The page does the grouping,
as it does the sorting, so the bands come in the order given and so do
the rows in each. Here the plants are sorted first and grouped after, so
a sort orders each band on its own.

**Plants by light**

```tsx
import { Table, sortRows, useTable, type Column, type TableGroup } from '@bh/table';
import { NumberColumn, TextColumn, tableRender } from '@bh/ui';

interface Plant {
  id: string;
  name: string;
  latin: string;
  light: 'sun' | 'part' | 'shade';
  /** Days between waterings. */
  water: number;
}

const PLANTS: Plant[] = [
  { id: '1', name: 'Rosemary', latin: 'Salvia rosmarinus', light: 'sun', water: 10 },
  { id: '2', name: 'Basil', latin: 'Ocimum basilicum', light: 'sun', water: 2 },
  { id: '3', name: 'Lavender', latin: 'Lavandula angustifolia', light: 'sun', water: 14 },
  { id: '4', name: 'Thyme', latin: 'Thymus vulgaris', light: 'sun', water: 12 },
  { id: '5', name: 'Tomato', latin: 'Solanum lycopersicum', light: 'sun', water: 2 },
  { id: '6', name: 'Geranium', latin: 'Pelargonium zonale', light: 'sun', water: 5 },
  { id: '7', name: 'Aloe', latin: 'Aloe vera', light: 'sun', water: 21 },
  { id: '8', name: 'Olive', latin: 'Olea europaea', light: 'sun', water: 9 },
  { id: '9', name: 'Mint', latin: 'Mentha spicata', light: 'part', water: 3 },
  { id: '10', name: 'Parsley', latin: 'Petroselinum crispum', light: 'part', water: 4 },
  { id: '11', name: 'Hydrangea', latin: 'Hydrangea macrophylla', light: 'part', water: 3 },
  { id: '12', name: 'Begonia', latin: 'Begonia semperflorens', light: 'part', water: 6 },
  { id: '13', name: 'Fuchsia', latin: 'Fuchsia magellanica', light: 'part', water: 4 },
  { id: '14', name: 'Hosta', latin: 'Hosta sieboldiana', light: 'shade', water: 5 },
  { id: '15', name: 'Fern', latin: 'Nephrolepis exaltata', light: 'shade', water: 3 },
  { id: '16', name: 'Peace lily', latin: 'Spathiphyllum wallisii', light: 'shade', water: 5 },
  { id: '17', name: 'Ivy', latin: 'Hedera helix', light: 'shade', water: 7 },
  { id: '18', name: 'Hellebore', latin: 'Helleborus niger', light: 'shade', water: 8 },
];

const LIGHT = [
  { key: 'sun', label: 'Full sun' },
  { key: 'part', label: 'Part shade' },
  { key: 'shade', label: 'Shade' },
] as const;

const columns: Column<Plant>[] = [
  {
    key: 'name',
    header: 'Plant',
    value: (p) => p.name,
    sortable: true,
    width: 'minmax(160px, 1fr)',
  },
  {
    key: 'latin',
    header: 'Latin name',
    value: (p) => p.latin,
    as: TextColumn({ mono: true }),
    width: 220,
  },
  {
    key: 'water',
    header: 'Water every (days)',
    value: (p) => p.water,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 170,
  },
];

export function PlantsByLight() {
  // Its handlers include onCollapseChange, which gives every band a toggle.
  const table = useTable({ initialCollapsed: ['shade'] });
  const sorted = sortRows(PLANTS, table.state.sort, columns);
  // The page groups the rows; the table draws the bands. Sorting sorts within each.
  const groups: TableGroup<Plant>[] = LIGHT.map(({ key, label }) => {
    const rows = sorted.filter((plant) => plant.light === key);
    return {
      key,
      header: (
        <>
          <span>{label}</span>
          <span className="text-11 text-gray-9 font-mono">{rows.length}</span>
        </>
      ),
      rows,
    };
  });
  return (
    <div className="h-360 w-full overflow-auto">
      <Table<Plant>
        {...table}
        columns={columns}
        rows={[]}
        groups={groups}
        // The band of the group in view stays under the header as its rows scroll by.
        stickyGroupHeader
        isLoading={false}
        render={tableRender<Plant>()}
      />
    </div>
  );
}
```

With `groups` given, `rows` is ignored; pass `[]`. A group with no rows
keeps its band, so a section that has filtered down to nothing says so
rather than vanishing.

## Collapsing

`onCollapseChange`, which `useTable` spreads, gives every band a toggle.
The collapsed groups are `state.collapsed`, a `Set` of keys, and
`useTable({ initialCollapsed })` starts some closed, as Shade is above.
A collapsed band stays, and its rows leave the table: they aren't drawn,
counted, focused or selected by the header's box. Without
`onCollapseChange` the bands are plain headers.

## The pinned band

`stickyGroupHeader` pins the band of the group in view under the column
header while its rows scroll by, so a long group still says what it is.
The pinned band is a second drawing of the real one, hidden from screen
readers, which read the band in its place; its toggle works as the real
one's does.

## Positions

Rows are numbered across the groups, from 0, counting only the rows of
open groups: the row `index` a skin is handed, `onRowClick`'s row and the
focused cell's `rowIndex` all use this one count, and the arrows go from
the last row of one group to the first of the next. Bands are not cells:
the arrows pass them by, and Tab reaches their toggles.

A band is `GROUP_ROW_HEIGHT`, 34 pixels, and a skin draws its bands that
tall: the table places every row below the first band by it.
`flattenGroups` turns the groups into the one list of bands and rows the
table scrolls through.

## Rules

- `groups` wins over `rows` when both are given.
- Collapsing is on only with `onCollapseChange`.
- A collapsed group keeps its band and drops its rows from everything:
  drawing, counting, focus and select-all.
- An empty group keeps its band.
- Row indices run on across groups and skip collapsed ones, so they
  always count the rows on screen.
- The pinned band is off unless `stickyGroupHeader` is given: it draws a
  band twice, which is a change to the page a caller asks for.

## Reference

```ts
interface TableGroup<T>
```

A band of rows under a header of its own, which `<Table groups>` draws in
order.

| Member              | Type        | Default | Description                                                         |
| ------------------- | ----------- | ------- | ------------------------------------------------------------------- |
| `key` (required)    | `string`    |         | Names the group in `TableState.collapsed`. Unique within the table. |
| `header` (required) | `ReactNode` |         | What the band says: a label, a count.                               |
| `rows` (required)   | `T[]`       |         | The group's rows, in the order drawn.                               |

```ts
flattenGroups<T>(groups: TableGroup<T>[], collapsed?: ReadonlySet<string>): VirtualRow<T>[]
```

The groups as one list of bands and rows, in order: the list the table
scrolls through. Each group's band comes first, then its rows, numbered
from 0 across all the groups.

Every group keeps its band, an empty one and a collapsed one too, so a
section that has filtered down to nothing says so rather than vanishing. A
collapsed group's rows are left out, and take no numbers.

| Parameter           | Type                  | Default | Description                       |
| ------------------- | --------------------- | ------- | --------------------------------- |
| `groups` (required) | `TableGroup<T>[]`     |         | The groups, in order.             |
| `collapsed`         | `ReadonlySet<string>` |         | The keys of the collapsed groups. |

Returns `VirtualRow<T>[]`.

```ts
type VirtualRow<T> =
  { kind: 'group'; key: string; header: ReactNode } | { kind: 'row'; row: T; index: number };
```

One entry in the list `flattenGroups` makes: a group's band, or a row and
its index among the rows on screen.

```ts
const GROUP_ROW_HEIGHT: 34;
```

A group band's height in pixels. A skin draws its bands this tall: the
virtualizer places every row below the first band by it.
