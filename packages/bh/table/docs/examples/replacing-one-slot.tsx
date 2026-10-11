import { useState } from 'react';
import { Table, useTable, type Column, type TableRender } from '@bh/table';
import { Button, tableRender } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  author: string;
}

const BOOKS: Book[] = [
  { id: '1', title: 'Invisible Cities', author: 'Italo Calvino' },
  { id: '2', title: 'Blindness', author: 'José Saramago' },
  { id: '3', title: 'The Book of Disquiet', author: 'Fernando Pessoa' },
];

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, width: 'minmax(180px, 1fr)' },
  { key: 'author', header: 'Author', value: (b) => b.author, width: 220 },
];

export function ReplacingOneSlot() {
  const table = useTable();
  const [books, setBooks] = useState(BOOKS);

  // @bh/ui's skin, with the empty state drawn here. Inside the grid, a slot
  // draws a row holding a cell, whatever it puts in the cell.
  const render: TableRender<Book> = {
    ...tableRender<Book>(),
    empty: () => {
      return (
        <div role="row">
          <div role="gridcell" className="flex flex-col items-center gap-8 px-16 py-32">
            <span className="text-13/19 text-gray-11">The shelf is empty.</span>
            <Button variant="outline" size="sm" onClick={() => setBooks(BOOKS)}>
              Put the books back
            </Button>
          </div>
        </div>
      );
    },
  };

  return (
    <div className="flex w-full flex-col items-start gap-8">
      <Button variant="ghost" size="sm" disabled={books.length === 0} onClick={() => setBooks([])}>
        Take every book off
      </Button>
      <div className="h-240 w-full overflow-auto">
        <Table<Book> {...table} columns={columns} rows={books} isLoading={false} render={render} />
      </div>
    </div>
  );
}
