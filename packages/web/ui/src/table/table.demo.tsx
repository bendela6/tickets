import { Table, sortRows, useTable, type Column } from '@tickets/table';
import { boolean, definePlayground, select } from '../gallery';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { rowHeightFor } from './metrics';
import { tableRender } from './table-render';
import { ActionsColumn } from './columns/actions-column';
import { BadgeColumn } from './columns/badge-column';
import { DateColumn } from './columns/date-column';
import { ImageColumn } from './columns/image-column';
import { LinkColumn } from './columns/link-column';
import { NumberColumn } from './columns/number-column';
import { TextColumn } from './columns/text-column';

export const meta = { title: 'Table', group: 'Components', size: 'full' };

type Row = {
  id: string;
  name: string;
  status: string;
  count: number;
  updated: string;
  owner: string;
  /** `null` on purpose for some rows: ImageColumn's whole second branch is the
   *  Avatar it falls back to when a row has no image, and a demo where every
   *  row has one never shows it. */
  avatar: string | null;
};

const OWNERS = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'];

/** An inline SVG rather than a URL. The gallery, the demos smoke test and the
 *  axe test all render this demo, and none of them may depend on the network. */
const SWATCH =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236e56cf"/></svg>';

const ROWS: Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: String(i),
  name: `Item ${i + 1}`,
  status: ['open', 'done', 'blocked'][i % 3]!,
  count: (i + 1) * 3,
  updated: new Date(2026, 6, 1 + (i % 28)).toISOString(),
  owner: OWNERS[i % OWNERS.length]!,
  avatar: i % 3 === 0 ? null : SWATCH,
}));

const STATUS_TONE: Record<string, 'blue' | 'green' | 'red'> = {
  open: 'blue',
  done: 'green',
  blocked: 'red',
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
 * LinkColumn, ImageColumn and ActionsColumn were shipped with no demo at all,
 * so nothing rendered them and nothing would have noticed them breaking.
 *
 * Both header-less columns carry real header text instead. A `columnheader`
 * with no accessible name is an axe `empty-table-header` finding, and this
 * demo is audited — a blank actions header is a design question worth its own
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
    // A hash href so the gallery does not navigate away when a link is clicked.
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

/** Two-line rows for every third item, to show the height function actually
 *  varying rather than a density toggle in disguise. */
const varyingRowHeight = (_row: Row | undefined, index: number) => (index % 3 === 0 ? 64 : 42);

function Demo({
  grouped,
  collapsedKeys,
  loading,
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
  error?: boolean;
  rowHeight?: number | ((row: Row | undefined, index: number) => number);
  empty?: boolean;
  filtered?: boolean;
  overlay?: boolean;
  columns?: Column<Row>[];
  selectable?: boolean;
}) {
  // All of the table's uncontrolled state in one line, spread onto <Table>
  // below. `widthsId` is what makes a dragged column width outlive a reload.
  const table = useTable({ widthsId: 'gallery-table-demo', initialCollapsed: collapsedKeys });
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
      ).map(([key, rows]) => ({
        key,
        header: (
          <>
            <span className="font-sans text-13/19 font-600 text-gray-12">{key}</span>
            <span className="font-mono text-11 text-gray-9">{rows.length}</span>
          </>
        ),
        rows,
      }))
    : undefined;
  return (
    <div className="h-100 w-full">
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
        error={error ? new Error('The server said no.') : null}
        isFiltered={Boolean(filtered)}
        rowHeight={rowHeight}
        // Absolutely positioned against the row, which the virtualizer has
        // already positioned — this is the arrangement a column cannot express,
        // since it would reserve width even while hidden.
        rowOverlay={
          overlay
            ? () => (
                <span className="absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-1.25 group-hover:flex">
                  <Button variant="outline" size="sm" className="w-7 p-0" aria-label="Open">
                    <Icon name="arrow-up-right" size="sm" />
                  </Button>
                </span>
              )
            : undefined
        }
        render={tableRender<Row>()}
      />
    </div>
  );
}

export const states = [
  { name: 'Flat', render: () => <Demo /> },
  // All 7 column helpers: Image, Link, Text, Badge, Number, Date, Actions.
  { name: 'Column helpers', render: () => <Demo columns={HELPER_COLUMNS} /> },
  { name: 'Selectable', render: () => <Demo columns={SELECT_COLUMNS} selectable /> },
  // Wider than its container: scroll sideways and Name stays put on the left,
  // Actions on the right, with a hairline where the frozen part ends.
  { name: 'Pinned columns', render: () => <Demo columns={WIDE_COLUMNS} /> },
  { name: 'Per-row height', render: () => <Demo rowHeight={varyingRowHeight} /> },
  { name: 'Grouped', render: () => <Demo grouped /> },
  { name: 'Grouped — collapsed', render: () => <Demo grouped collapsedKeys={['open']} /> },
  { name: 'Row overlay', render: () => <Demo overlay /> },
  { name: 'Loading', render: () => <Demo loading /> },
  { name: 'Empty', render: () => <Demo empty /> },
  { name: 'Empty — filtered', render: () => <Demo empty filtered /> },
  { name: 'Error', render: () => <Demo error /> },
];

// Minimal playground: enough to mount the A11y tab (component-page.tsx gates
// it on `demo.playground`) so axe actually sees table markup, not a full
// workbench. `grouped` exercises the group-header/rowgroup branch; `density`
// exercises the row-height plumbing (Fix 7) rather than duplicating a control
// per prop the engine takes.
export const playground = definePlayground({
  controls: {
    grouped: boolean(),
    density: select(['comfortable', 'compact'] as const, { initial: 'comfortable' }),
  },
  // `rowHeightFor` rather than a literal: the virtualizer needs a pixel number
  // up front, and this is the one place that number is allowed to come from.
  render: (v) => <Demo grouped={v.grouped} rowHeight={rowHeightFor(v.density)} />,
});
