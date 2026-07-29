import { useState } from 'react';
import { Table, useTableWidths, type Column, type SortBy } from '@tickets/table';
import { boolean, definePlayground, select } from '../gallery';
import { tableRender } from './table-render';
import { BadgeColumn } from './columns/badge-column';
import { DateColumn } from './columns/date-column';
import { NumberColumn } from './columns/number-column';
import { TextColumn } from './columns/text-column';

export const meta = { title: 'Table', group: 'Components', size: 'full' };

type Row = { id: string; name: string; status: string; count: number; updated: string };

const ROWS: Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: String(i),
  name: `Item ${i + 1}`,
  status: ['open', 'done', 'blocked'][i % 3]!,
  count: (i + 1) * 3,
  updated: new Date(2026, 6, 1 + (i % 28)).toISOString(),
}));

const STATUS_TONE: Record<string, 'blue' | 'green' | 'red'> = {
  open: 'blue',
  done: 'green',
  blocked: 'red',
};

const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name, as: TextColumn(), sortable: true, width: 'minmax(200px, 1fr)' },
  { key: 'status', header: 'Status', value: (r) => r.status, as: BadgeColumn<string>({ tone: (v) => STATUS_TONE[v] ?? 'gray' }), width: 120 },
  { key: 'count', header: 'Count', value: (r) => r.count, as: NumberColumn({ format: 'integer' }), align: 'right', width: 100, sortable: true },
  { key: 'updated', header: 'Updated', value: (r) => r.updated, as: DateColumn(), width: 140 },
];

function Demo({
  grouped,
  loading,
  error,
  rowHeight,
}: {
  grouped?: boolean;
  loading?: boolean;
  error?: boolean;
  rowHeight?: number;
}) {
  const [sort, setSort] = useState<SortBy[]>([]);
  const [widths, setWidth] = useTableWidths('gallery-table-demo');
  const groups = grouped
    ? Object.entries(
        ROWS.reduce<Record<string, Row[]>>((acc, row) => {
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
        columns={COLUMNS}
        // `loading` must also empty `rows`. The engine only renders skeletons
        // when `isLoading && items.length === 0`, so passing 40 rows alongside
        // isLoading makes the Loading state pixel-identical to Flat and leaves
        // render-skeleton-row.tsx exercised by nothing.
        rows={grouped || loading ? [] : ROWS}
        groups={groups}
        state={{ sort, widths }}
        onSortChange={setSort}
        onWidthChange={setWidth}
        onRowClick={() => {}}
        isLoading={Boolean(loading)}
        error={error ? new Error('The server said no.') : null}
        rowHeight={rowHeight}
        render={tableRender<Row>()}
      />
    </div>
  );
}

export const states = [
  { name: 'Flat', render: () => <Demo /> },
  { name: 'Grouped', render: () => <Demo grouped /> },
  { name: 'Loading', render: () => <Demo loading /> },
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
  render: (v) => (
    <Demo grouped={v.grouped} rowHeight={v.density === 'compact' ? 32 : undefined} />
  ),
});
