import { Table, sortRows, useTable, type Column } from '@bh/table';
import { BadgeColumn, DateColumn, NumberColumn, TextColumn, tableRender, type Tone } from '@bh/ui';

interface File {
  id: string;
  name: string;
  kind: string;
  /** In kilobytes; none for a folder. */
  size: number | null;
  modified: string;
}

const FILES: File[] = [
  {
    id: '1',
    name: 'Garden plan.pdf',
    kind: 'document',
    size: 482,
    modified: '2026-09-28T09:12:00Z',
  },
  { id: '2', name: 'Holiday photos', kind: 'folder', size: null, modified: '2026-08-14T17:40:00Z' },
  { id: '3', name: 'Budget 2026.xlsx', kind: 'sheet', size: 96, modified: '2026-09-30T08:05:00Z' },
  { id: '4', name: 'Lisbon tram.jpg', kind: 'image', size: 3120, modified: '2026-07-02T11:20:00Z' },
  { id: '5', name: 'Recipes.docx', kind: 'document', size: 214, modified: '2026-06-19T19:02:00Z' },
  {
    id: '6',
    name: 'Backup 09-2026.zip',
    kind: 'archive',
    size: 58200,
    modified: '2026-09-01T02:00:00Z',
  },
  { id: '7', name: 'Reading list.md', kind: 'document', size: 6, modified: '2026-09-29T21:44:00Z' },
  {
    id: '8',
    name: 'Tbilisi old town.jpg',
    kind: 'image',
    size: 2870,
    modified: '2026-05-23T14:31:00Z',
  },
  { id: '9', name: 'Seed orders.xlsx', kind: 'sheet', size: 41, modified: '2026-03-11T10:15:00Z' },
  { id: '10', name: 'Scans', kind: 'folder', size: null, modified: '2026-09-12T16:00:00Z' },
  {
    id: '11',
    name: 'Bike receipt.pdf',
    kind: 'document',
    size: 133,
    modified: '2026-04-08T12:47:00Z',
  },
  { id: '12', name: 'Fonts.zip', kind: 'archive', size: 12400, modified: '2026-02-17T09:30:00Z' },
  {
    id: '13',
    name: 'Porto bridge.jpg',
    kind: 'image',
    size: 4410,
    modified: '2026-07-05T18:09:00Z',
  },
  {
    id: '14',
    name: 'Flat inventory.xlsx',
    kind: 'sheet',
    size: 28,
    modified: '2026-01-26T20:20:00Z',
  },
  { id: '15', name: 'Letters', kind: 'folder', size: null, modified: '2025-12-03T08:00:00Z' },
  {
    id: '16',
    name: 'Tax return 2025.pdf',
    kind: 'document',
    size: 905,
    modified: '2026-04-29T15:55:00Z',
  },
];

const KIND_TONE: Record<string, Tone> = {
  folder: 'gray',
  document: 'blue',
  sheet: 'green',
  image: 'purple',
  archive: 'orange',
};

const columns: Column<File>[] = [
  {
    key: 'name',
    header: 'Name',
    value: (file) => file.name,
    as: TextColumn(),
    sortable: true,
    width: 'minmax(220px, 1fr)',
  },
  {
    key: 'kind',
    header: 'Kind',
    value: (file) => file.kind,
    as: BadgeColumn<string>({ tone: (kind) => KIND_TONE[kind] ?? 'gray' }),
    sortable: true,
    width: 120,
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

export function Files() {
  // The app names the key its widths are saved under.
  const table = useTable({ storageKey: 'docs:files' });
  return (
    // The page scrolls a table, not the table itself: this box stands in for the page.
    <div className="h-360 w-full overflow-auto">
      <Table<File>
        {...table}
        columns={columns}
        rows={sortRows(FILES, table.state.sort, columns)}
        isLoading={false}
        render={tableRender<File>()}
      />
    </div>
  );
}
