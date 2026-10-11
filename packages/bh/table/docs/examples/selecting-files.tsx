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
