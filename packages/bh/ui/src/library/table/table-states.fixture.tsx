import { useState } from 'react';
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { Button } from '../primitives/components/button';
import { Icon } from '../primitives/components/icon';
import { Input } from '../inputs/components/input';
import { Combobox } from '../inputs/components/combobox';
import { rowHeightFor } from './parts/metrics';
import { tableRender } from './table-render';
import { ActionsColumn } from './columns/actions-column';
import { BadgeColumn } from './columns/badge-column';
import { DateColumn } from './columns/date-column';
import { ImageColumn } from './columns/image-column';
import { LinkColumn } from './columns/link-column';
import { NumberColumn } from './columns/number-column';
import { TextColumn } from './columns/text-column';

// Every state the table skin has to draw, for the axe audit in
// table-a11y.test.tsx. These were the old gallery's table states; a state
// added here is audited the day it lands.

interface Row {
  id: string;
  name: string;
  status: string;
  count: number;
  updated: string;
  owner: string;
  /** `null` on purpose for some rows: ImageColumn's whole second branch is the
   *  Avatar it falls back to when a row has no image, and a table where every
   *  row has one never shows it. */
  avatar: string | null;
}

const OWNERS = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'];

/** An inline SVG rather than a URL: the axe test may not depend on the
 *  network. */
const SWATCH =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236e56cf"/></svg>';

const ROWS: Row[] = Array.from({ length: 40 }, (_, i) => {
  return {
    id: String(i),
    name: `Item ${i + 1}`,
    status: ['open', 'done', 'failed'][i % 3] ?? 'open',
    count: (i + 1) * 3,
    updated: new Date(2026, 6, 1 + (i % 28)).toISOString(),
    owner: OWNERS[i % OWNERS.length] ?? '',
    avatar: i % 3 === 0 ? null : SWATCH,
  };
});

const STATUS_TONE: Record<string, 'blue' | 'green' | 'red'> = {
  open: 'blue',
  done: 'green',
  failed: 'red',
};

const COLUMNS: Column<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    value: (r) => r.name,
    as: TextColumn(),
    sortable: true,
    width: 'minmax(200px, 1fr)',
  },
  {
    key: 'status',
    header: 'Status',
    value: (r) => r.status,
    as: BadgeColumn<string>({ tone: (v) => STATUS_TONE[v] ?? 'gray' }),
    width: 120,
  },
  {
    key: 'count',
    header: 'Count',
    value: (r) => r.count,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 100,
    sortable: true,
  },
  { key: 'updated', header: 'Updated', value: (r) => r.updated, as: DateColumn(), width: 140 },
];

/**
 * Every column helper the adapter ships, in one table.
 *
 * The four-column set above covers the common case; this one exists because
 * LinkColumn, ImageColumn and ActionsColumn were once shipped with nothing
 * rendering them, and nothing would have noticed them breaking.
 *
 * Both header-less columns carry real header text instead. A `columnheader`
 * with no accessible name is an axe `empty-table-header` finding, and this
 * set is audited — a blank actions header is a design question worth its own
 * pass (visually-hidden label), not something to smuggle in here.
 */
const HELPER_COLUMNS: Column<Row>[] = [
  {
    key: 'avatar',
    header: 'Owner',
    value: (r) => r.avatar,
    as: ImageColumn({ fallback: (row) => (row as Row).owner }),
    width: 60,
    resizable: false,
  },
  {
    key: 'name',
    header: 'Name',
    value: (r) => r.name,
    // A hash href, so a click on the link never leaves the page.
    as: LinkColumn({ href: (row) => `#/items/${(row as Row).id}` }),
    sortable: true,
    width: 'minmax(160px, 1fr)',
  },
  { key: 'owner', header: 'Assignee', value: (r) => r.owner, as: TextColumn(), width: 150 },
  {
    key: 'status',
    header: 'Status',
    value: (r) => r.status,
    as: BadgeColumn<string>({ tone: (v) => STATUS_TONE[v] ?? 'gray' }),
    width: 110,
  },
  {
    key: 'count',
    header: 'Count',
    value: (r) => r.count,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 90,
    sortable: true,
  },
  { key: 'updated', header: 'Updated', value: (r) => r.updated, as: DateColumn(), width: 130 },
  {
    key: 'actions',
    header: 'Actions',
    // No `value`: ActionsColumn reads the row, never a cell value.
    as: ActionsColumn({
      items: [
        { icon: 'copy', label: 'Copy link', onClick: () => {} },
        { icon: 'pencil', label: 'Edit', onClick: () => {} },
        { icon: 'trash', label: 'Delete', onClick: () => {}, tone: 'danger' },
      ],
    }),
    align: 'right',
    width: 130,
    resizable: false,
  },
];

/**
 * The four-column set with a selection checkbox in front. `select: true` is
 * all a caller writes — the engine owns the column's content, because only it
 * knows what is selected, and the checkbox itself comes from the render set's
 * `selectCell` slot so no glyph leaks into the engine.
 *
 * `header: ''` is right here and wrong in HELPER_COLUMNS: the header cell
 * holds the select-all checkbox, which carries its own accessible name, so
 * there is nothing anonymous about it.
 */
/** The four-column set with a totals row. The engine holds no opinion about
 *  what the numbers mean, so the arithmetic is the caller's — here a count and
 *  a sum over ROWS. */
const FOOTER_COLUMNS: Column<Row>[] = COLUMNS.map((c) => {
  return c.key === 'name'
    ? { ...c, footer: `${ROWS.length} items` }
    : c.key === 'count'
      ? { ...c, footer: String(ROWS.reduce((sum, r) => sum + r.count, 0)) }
      : c;
});

/** A header filter box that holds what is typed. The state is the row's
 *  look, not a query, so nothing is filtered. */
function DemoFilterInput({ label }: { label: string }) {
  const [value, setValue] = useState('');
  return (
    <Input
      size="xs"
      className="w-full"
      aria-label={`Filter ${label.toLowerCase()}`}
      placeholder={`${label} contains…`}
      value={value}
      onChange={setValue}
    />
  );
}

function DemoFilterSelect() {
  const [value, setValue] = useState<string | null>('');
  return (
    <Combobox
      searchable={false}
      size="xs"
      className="w-full"
      aria-label="Filter status"
      value={value}
      onChange={setValue}
      options={[
        //
        { value: '', label: 'Any status' },
        { value: 'open', label: 'Open', color: 'blue' },
        { value: 'done', label: 'Done', color: 'green' },
        { value: 'failed', label: 'Failed', color: 'red' },
      ]}
    />
  );
}

/** The four-column set with a filter row under the header: a control per
 *  filtered column, none under Updated. */
const FILTER_ROW_COLUMNS: Column<Row>[] = COLUMNS.map((c) => {
  return c.key === 'name'
    ? { ...c, filter: <DemoFilterInput label="Name" /> }
    : c.key === 'status'
      ? { ...c, filter: <DemoFilterSelect /> }
      : c;
});

/** A funnel after a header's label — the popover mode's trigger. Accent while
 *  its column is filtered, which is Status here. */
function DemoFunnel({ label, active }: { label: string; active: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      tone={active ? 'primary' : 'neutral'}
      aria-label={`Filter ${label.toLowerCase()}`}
      aria-pressed={active}
      className="h-24 w-24 p-0"
    >
      <Icon name="filter" size="sm" />
    </Button>
  );
}

const FUNNEL_COLUMNS: Column<Row>[] = COLUMNS.map((c) => {
  return c.key === 'status' || c.key === 'count'
    ? { ...c, headerAccessory: <DemoFunnel label={c.header} active={c.key === 'status'} /> }
    : c;
});

const SELECT_COLUMNS: Column<Row>[] = [
  { key: 'select', header: '', select: true, width: 36, resizable: false },
  ...COLUMNS,
];

/**
 * A table wider than its container, with the leading column frozen and the
 * actions column frozen to the other edge. This is the arrangement pinning
 * exists for: scroll sideways through ten columns and still know which row
 * you are on and still reach its actions.
 *
 * Every column takes a fixed pixel width, deliberately. A pinned column's
 * offset is the sum of the pinned widths outside it, and a track function
 * like `minmax(240px, 1fr)` has no width to sum.
 */
const WIDE_COLUMNS: Column<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    value: (r) => r.name,
    as: TextColumn(),
    sortable: true,
    width: 180,
    pinned: 'left',
  },
  { key: 'owner', header: 'Assignee', value: (r) => r.owner, as: TextColumn(), width: 170 },
  {
    key: 'status',
    header: 'Status',
    value: (r) => r.status,
    as: BadgeColumn<string>({ tone: (v) => STATUS_TONE[v] ?? 'gray' }),
    width: 130,
  },
  {
    key: 'count',
    header: 'Count',
    value: (r) => r.count,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 120,
    sortable: true,
  },
  { key: 'updated', header: 'Updated', value: (r) => r.updated, as: DateColumn(), width: 170 },
  { key: 'created', header: 'Created', value: (r) => r.updated, as: DateColumn(), width: 170 },
  {
    key: 'link',
    header: 'Link',
    value: (r) => r.name,
    as: LinkColumn({ href: (row) => `#/items/${(row as Row).id}` }),
    width: 170,
  },
  {
    key: 'actions',
    header: 'Actions',
    as: ActionsColumn({
      items: [
        { icon: 'pencil', label: 'Edit', onClick: () => {} },
        { icon: 'trash', label: 'Delete', onClick: () => {}, tone: 'danger' },
      ],
    }),
    align: 'right',
    width: 110,
    resizable: false,
    pinned: 'right',
  },
];

/**
 * Both at once: frozen columns AND a totals row.
 *
 * Its own state rather than a footnote on either of the two above, because the
 * interesting part only exists where they meet. Each feature on its own looks
 * right whatever the other does; what has to be looked at is the totals row's
 * cell under a FROZEN column, which must hold still while the sheet slides —
 * and no other state here scrolls a totals row sideways at all, so
 * a regression there is invisible everywhere else.
 */
const WIDE_FOOTER_COLUMNS: Column<Row>[] = WIDE_COLUMNS.map((c) => {
  return c.key === 'name'
    ? { ...c, footer: `${ROWS.length} items` }
    : c.key === 'count'
      ? { ...c, footer: String(ROWS.reduce((sum, r) => sum + r.count, 0)) }
      : c;
});

/** Two-line rows for every third item, to show the height function actually
 *  varying rather than a density toggle in disguise. */
const varyingRowHeight = (_row: Row | undefined, index: number) => (index % 3 === 0 ? 64 : 42);

function Example({
  grouped,
  collapsedKeys,
  loading,
  refreshing,
  error,
  rowHeight,
  empty,
  filtered,
  overlay,
  columns = COLUMNS,
  selectable,
}: {
  grouped?: boolean;
  collapsedKeys?: string[];
  loading?: boolean;
  refreshing?: boolean;
  error?: boolean;
  rowHeight?: number | ((row: Row | undefined, index: number) => number);
  empty?: boolean;
  filtered?: boolean;
  overlay?: boolean;
  columns?: Column<Row>[];
  selectable?: boolean;
}) {
  // All of the table's uncontrolled state in one line, spread onto <Table>
  // below. No `storageKey`, so nothing is kept between tests.
  const table = useTable({ initialCollapsed: collapsedKeys });
  // The engine emits sort intent and never reorders anything, so a
  // client-sorted caller runs the rows through `sortRows` itself. Shift-click
  // a second header and the ordinals in the header row describe an ordering
  // this actually performs.
  const sorted = sortRows(ROWS, table.state.sort, columns);
  const groups = grouped
    ? Object.entries(
        sorted.reduce<Record<string, Row[]>>((acc, row) => {
          (acc[row.status] ??= []).push(row);
          return acc;
        }, {}),
      ).map(([key, rows]) => {
        return {
          key,
          header: (
            <>
              <span className="text-13/19 font-600 text-gray-12 font-sans">{key}</span>
              <span className="text-11 text-gray-9 font-mono">{rows.length}</span>
            </>
          ),
          rows,
        };
      })
    : undefined;
  return (
    // A scroll HOST, not a viewport for the table to fill. The table has no
    // scrollbar of its own any more — it is as tall as its rows and whatever
    // is scrolling the page scrolls it — so this box gives it something
    // to scroll inside, and forty rows do not push every other state off the
    // end of the page. In an app this is the app shell's `<main>`.
    <div className="h-400 w-full overflow-auto">
      <Table<Row>
        {...table}
        columns={columns}
        // `loading` must also empty `rows`. The engine only renders skeletons
        // when `isLoading && items.length === 0`, so passing 40 rows alongside
        // isLoading makes the Loading state pixel-identical to Flat and leaves
        // render-skeleton-row.tsx exercised by nothing.
        rows={grouped || loading || empty ? [] : sorted}
        groups={groups}
        stickyGroupHeader={Boolean(grouped)}
        // `getRowId` alongside onSelectionChange (which arrives with the
        // spread) is what turns selection on.
        getRowId={selectable ? (r) => r.id : undefined}
        onRowClick={() => {}}
        onRowActivate={() => {}}
        isLoading={Boolean(loading)}
        isRefreshing={Boolean(refreshing)}
        error={error ? new Error('The source answered HTTP 502 · retrying in 30s') : null}
        isFiltered={Boolean(filtered)}
        // Each state's one action, per A8. They are the reason the state
        // shows a button at all: without a caller-supplied handler the slots
        // draw copy and nothing else, which is also what a page that has no
        // retry to offer gets.
        onRetry={() => {}}
        onClearFilters={() => {}}
        rowHeight={rowHeight}
        // Absolutely positioned against the row, which the virtualizer has
        // already positioned — this is the arrangement a column cannot express,
        // since it would reserve width even while hidden.
        rowOverlay={
          overlay
            ? () => {
                return (
                  <span className="absolute top-1/2 right-10 hidden -translate-y-1/2 items-center gap-5 group-hover:flex">
                    <Button variant="outline" size="sm" className="w-28 p-0" aria-label="Open">
                      <Icon name="arrow-up-right" size="sm" />
                    </Button>
                  </span>
                );
              }
            : undefined
        }
        render={tableRender<Row>()}
      />
    </div>
  );
}

export const states = [
  { name: 'Flat', render: () => <Example /> },
  // All 7 column helpers: Image, Link, Text, Badge, Number, Date, Actions.
  { name: 'Column helpers', render: () => <Example columns={HELPER_COLUMNS} /> },
  { name: 'Selectable', render: () => <Example columns={SELECT_COLUMNS} selectable /> },
  // Wider than its container: scroll sideways and Name stays put on the left,
  // Actions on the right, with a hairline where the frozen part ends.
  { name: 'Pinned columns', render: () => <Example columns={WIDE_COLUMNS} /> },
  { name: 'Totals row', render: () => <Example columns={FOOTER_COLUMNS} /> },
  // Both: scroll sideways and the totals row's "40 items" must stay under the
  // frozen Name column it totals, exactly as the cells above it do.
  { name: 'Totals row — pinned', render: () => <Example columns={WIDE_FOOTER_COLUMNS} /> },
  // A control per filtered column in a second header row that sticks with it.
  { name: 'Header filters — row', render: () => <Example columns={FILTER_ROW_COLUMNS} /> },
  // A funnel after the label; a click on it never sorts.
  { name: 'Header filters — funnel', render: () => <Example columns={FUNNEL_COLUMNS} /> },
  { name: 'Per-row height', render: () => <Example rowHeight={varyingRowHeight} /> },
  { name: 'Grouped', render: () => <Example grouped /> },
  { name: 'Grouped — collapsed', render: () => <Example grouped collapsedKeys={['open']} /> },
  { name: 'Compact', render: () => <Example rowHeight={rowHeightFor('compact')} /> },
  { name: 'Row overlay', render: () => <Example overlay /> },
  { name: 'Loading', render: () => <Example loading /> },
  { name: 'Refreshing', render: () => <Example refreshing /> },
  { name: 'Empty', render: () => <Example empty /> },
  { name: 'Empty — filtered', render: () => <Example empty filtered /> },
  { name: 'Error', render: () => <Example error /> },
];
