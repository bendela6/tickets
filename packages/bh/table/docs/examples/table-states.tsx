import { useState } from 'react';
import { Table, useTable, type Column } from '@bh/table';
import { SegmentedControl, tableRender } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
}

const BOOKS: Book[] = [
  { id: '1', title: 'Invisible Cities', author: 'Italo Calvino', year: 1972 },
  { id: '2', title: 'Blindness', author: 'José Saramago', year: 1995 },
  { id: '3', title: 'The Book of Disquiet', author: 'Fernando Pessoa', year: 1982 },
  { id: '4', title: 'The Leopard', author: 'Giuseppe Tomasi di Lampedusa', year: 1958 },
  { id: '5', title: 'The Name of the Rose', author: 'Umberto Eco', year: 1980 },
];

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, width: 'minmax(180px, 1fr)' },
  { key: 'author', header: 'Author', value: (b) => b.author, width: 220 },
  { key: 'year', header: 'Year', value: (b) => b.year, align: 'right', width: 90 },
];

const STATES = [
  { value: 'rows', label: 'Rows' },
  { value: 'loading', label: 'Loading' },
  { value: 'refreshing', label: 'Refreshing' },
  { value: 'empty', label: 'Empty' },
  { value: 'filtered', label: 'Filtered' },
  { value: 'error', label: 'Error' },
];

// The words for "no rows yet" are the table's own; every other state's are the skin's.
const render = tableRender<Book>({
  empty: { title: 'No books yet', detail: 'Books you add show up here.' },
});

export function TableStates() {
  const table = useTable();
  const [state, setState] = useState('rows');
  const hasRows = state === 'rows' || state === 'refreshing';
  return (
    <div className="flex w-full flex-col gap-12">
      <SegmentedControl
        label="State"
        size="xs"
        options={STATES}
        value={state}
        onChange={setState}
      />
      <div className="h-320 w-full overflow-auto">
        <Table<Book>
          {...table}
          columns={columns}
          rows={hasRows ? BOOKS : []}
          isLoading={state === 'loading'}
          isRefreshing={state === 'refreshing'}
          isFiltered={state === 'filtered'}
          error={
            state === 'error' ? new Error('The library did not answer · retrying in 30s') : null
          }
          // Each state's one action; without them the skin draws no button.
          onRetry={() => setState('rows')}
          onClearFilters={() => setState('rows')}
          render={render}
        />
      </div>
    </div>
  );
}
