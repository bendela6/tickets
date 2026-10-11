import { useState } from 'react';
import { Table, sortRows, useTable, type Column, type SortBy } from '@bh/table';
import { NumberColumn, SegmentedControl, tableRender } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  pages: number;
}

const BOOKS: Book[] = [
  { id: '1', title: 'The Leopard', author: 'Giuseppe Tomasi di Lampedusa', year: 1958, pages: 330 },
  { id: '2', title: 'Blindness', author: 'José Saramago', year: 1995, pages: 352 },
  { id: '3', title: 'The Book of Disquiet', author: 'Fernando Pessoa', year: 1982, pages: 544 },
  { id: '4', title: 'Invisible Cities', author: 'Italo Calvino', year: 1972, pages: 165 },
  { id: '5', title: 'The Shadow of the Wind', author: 'Carlos Ruiz Zafón', year: 2001, pages: 487 },
  {
    id: '6',
    title: 'A Man Was Going Down the Road',
    author: 'Otar Chiladze',
    year: 1973,
    pages: 384,
  },
  { id: '7', title: 'The Name of the Rose', author: 'Umberto Eco', year: 1980, pages: 536 },
  { id: '8', title: 'Don Quixote', author: 'Miguel de Cervantes', year: 1605, pages: 992 },
  { id: '9', title: 'Baltasar and Blimunda', author: 'José Saramago', year: 1982, pages: 352 },
  {
    id: '10',
    title: 'If on a Winter’s Night a Traveler',
    author: 'Italo Calvino',
    year: 1979,
    pages: 260,
  },
];

const columns: Column<Book>[] = [
  {
    key: 'title',
    header: 'Title',
    value: (book) => book.title,
    sortable: true,
    width: 'minmax(200px, 1fr)',
  },
  { key: 'author', header: 'Author', value: (book) => book.author, sortable: true, width: 220 },
  {
    key: 'year',
    header: 'Year',
    value: (book) => book.year,
    align: 'right',
    sortable: true,
    width: 90,
  },
  {
    key: 'pages',
    header: 'Pages',
    value: (book) => book.pages,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 100,
  },
];

const ORDERS = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'year', label: 'Year' },
];

export function SortFromOutside() {
  const table = useTable();
  // The page holds the sort, so the control above the table and its headers
  // change the same value. Everything else stays with useTable.
  const [sort, setSort] = useState<SortBy[]>([{ field: 'year', direction: 'asc' }]);
  return (
    <div className="flex w-full flex-col gap-12">
      <SegmentedControl
        label="Sort by"
        options={ORDERS}
        value={sort[0]?.field ?? ''}
        onChange={(field) => setSort([{ field, direction: 'asc' }])}
      />
      <div className="h-320 w-full overflow-auto">
        <Table<Book>
          {...table}
          state={{ ...table.state, sort }}
          onSortChange={setSort}
          columns={columns}
          rows={sortRows(BOOKS, sort, columns)}
          isLoading={false}
          render={tableRender<Book>()}
        />
      </div>
    </div>
  );
}
