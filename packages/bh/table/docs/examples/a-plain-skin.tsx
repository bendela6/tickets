import {
  Table,
  sortRows,
  useColumnResize,
  useTable,
  type Column,
  type RenderThResize,
  type TableRender,
} from '@bh/table';
import { cn } from '@bh/ui';

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
  { id: '6', title: 'Don Quixote', author: 'Miguel de Cervantes', year: 1605 },
];

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, sortable: true, width: 220 },
  { key: 'author', header: 'Author', value: (b) => b.author, sortable: true, width: 240 },
  { key: 'year', header: 'Year', value: (b) => b.year, sortable: true, align: 'right', width: 90 },
];

/** A slot is a function, not a component: a hook goes in a component it draws. */
function Grip({ resize }: { resize: RenderThResize }) {
  const drag = useColumnResize({
    startWidth: resize.startWidth,
    minWidth: resize.minWidth,
    onChange: resize.onWidthChange,
  });
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      {...drag}
      onDoubleClick={resize.onAutoFit}
      className="hover:bg-gray-8 absolute top-0 right-0 h-full w-4 cursor-col-resize"
    />
  );
}

const cell = 'flex min-w-0 items-center px-12';

const plain: TableRender<Book> = {
  root: ({ children, rowCount, colCount }) => {
    return (
      <div
        role="grid"
        aria-rowcount={rowCount}
        aria-colcount={colCount}
        className="text-13/19 font-sans"
      >
        {children}
      </div>
    );
  },
  thead: ({ children, gridTemplate }) => {
    return (
      <div
        role="row"
        className="bg-gray-3 border-gray-7 sticky top-0 z-10 grid h-36 border-b-1"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {children}
      </div>
    );
  },
  th: ({ column, sort, onSortClick, resize, focusProps }) => {
    return (
      <div
        role="columnheader"
        aria-sort={sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
        // The roving tab stop and the cell's address: always spread.
        {...focusProps}
        className={cn(
          cell,
          'font-500 focus-visible:outline-indigo-9 relative focus-visible:outline-2',
        )}
      >
        {column.sortable ? (
          // Not a tab stop of its own: the cell is. Enter on the cell clicks it.
          <button type="button" tabIndex={-1} onClick={onSortClick} className="cursor-pointer">
            {column.header}
            {sort ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ) : (
          column.header
        )}
        {resize ? <Grip resize={resize} /> : null}
      </div>
    );
  },
  // The ref and the padding place the rows the virtualizer has mounted.
  tbody: ({ children, ref, style }) => {
    return (
      <div role="rowgroup" ref={ref} style={style}>
        {children}
      </div>
    );
  },
  tr: ({ cells, gridTemplate, style, ariaRowIndex, onClick }) => {
    return (
      <div
        role="row"
        aria-rowindex={ariaRowIndex}
        onClick={onClick}
        className="border-gray-5 hover:bg-gray-2 grid border-b-1"
        // `style` is the row's height, which the virtualizer counted on.
        style={{ ...style, gridTemplateColumns: gridTemplate }}
      >
        {cells}
      </div>
    );
  },
  td: ({ column, children, focused, focusProps }) => {
    return (
      <div
        role="gridcell"
        {...focusProps}
        className={cn(
          cell,
          column.align === 'right' && 'justify-end',
          focused && 'ring-indigo-9 ring-2 outline-none ring-inset',
        )}
      >
        {children}
      </div>
    );
  },
  groupHeader: ({ header, style }) => {
    return (
      <div role="row" style={style} className="bg-gray-2">
        <div role="gridcell" className={cn(cell, 'h-full')}>
          {header}
        </div>
      </div>
    );
  },
  skeletonRow: ({ columns: all, gridTemplate, rowHeight }) => {
    return (
      <div
        aria-hidden
        className="grid"
        style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
      >
        {all.map((column) => {
          return (
            <div key={column.key} className={cell}>
              <span className="bg-gray-4 rounded-4 h-8 w-3/5" />
            </div>
          );
        })}
      </div>
    );
  },
  error: ({ error, onRetry }) => {
    return (
      <div role="row">
        <div role="gridcell" className="p-24 text-center">
          <p role="alert">{error.message}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  },
  empty: ({ filtered }) => {
    return (
      <div role="row">
        <div role="gridcell" className="text-gray-11 p-24 text-center">
          {filtered ? 'No books match.' : 'No books yet.'}
        </div>
      </div>
    );
  },
  tfoot: ({ columns: all, gridTemplate }) => {
    return (
      <div role="row" className="grid h-32" style={{ gridTemplateColumns: gridTemplate }}>
        {all.map((column) => {
          return (
            <div key={column.key} role="gridcell" className={cell}>
              {column.footer}
            </div>
          );
        })}
      </div>
    );
  },
};

export function APlainSkin() {
  const table = useTable();
  return (
    <div className="border-gray-6 h-280 w-full overflow-auto border-1">
      <Table<Book>
        {...table}
        columns={columns}
        rows={sortRows(BOOKS, table.state.sort, columns)}
        isLoading={false}
        render={plain}
      />
    </div>
  );
}
