import { useState } from 'react';
import { Table, useTableWidths, type Column, type SortBy } from '@tickets/table';
import { boolean, definePlayground, select } from '../gallery';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { rowHeightFor } from './metrics';
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
  empty,
  filtered,
  overlay,
}: {
  grouped?: boolean;
  loading?: boolean;
  error?: boolean;
  rowHeight?: number;
  empty?: boolean;
  filtered?: boolean;
  overlay?: boolean;
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
        rows={grouped || loading || empty ? [] : ROWS}
        groups={groups}
        state={{ sort, widths }}
        onSortChange={setSort}
        onWidthChange={setWidth}
        onRowClick={() => {}}
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
  { name: 'Grouped', render: () => <Demo grouped /> },
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
