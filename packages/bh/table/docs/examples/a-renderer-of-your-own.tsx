import { Table, useTable, type Column, type Renderer } from '@bh/table';
import { cn, tableRender } from '@bh/ui';

interface Book {
  id: string;
  title: string;
  stock: number;
}

const BOOKS: Book[] = [
  { id: '1', title: 'Invisible Cities', stock: 12 },
  { id: '2', title: 'Blindness', stock: 3 },
  { id: '3', title: 'The Book of Disquiet', stock: 0 },
  { id: '4', title: 'The Leopard', stock: 7 },
  { id: '5', title: 'The Name of the Rose', stock: 20 },
];

/**
 * A bar for how many copies are left, out of `full`. Like @bh/ui's helpers,
 * it is called once, where the column is written, and returns the renderer.
 */
function StockColumn(full: number): Renderer<number> {
  return ({ value }) => {
    const share = Math.min(1, value / full);
    return (
      <span className="flex w-full items-center gap-8">
        {/* The number says it; the bar only shows it. */}
        <span aria-hidden className="bg-gray-4 rounded-2 h-6 flex-1">
          <span
            className={cn('rounded-2 block h-6', value < 5 ? 'bg-orange-9' : 'bg-green-9')}
            style={{ width: `${share * 100}%` }}
          />
        </span>
        <span className="text-12/17 w-24 text-right font-mono tabular-nums">{value}</span>
      </span>
    );
  };
}

const columns: Column<Book>[] = [
  { key: 'title', header: 'Title', value: (b) => b.title, width: 'minmax(180px, 1fr)' },
  { key: 'stock', header: 'In stock', value: (b) => b.stock, as: StockColumn(20), width: 200 },
];

export function ARendererOfYourOwn() {
  const table = useTable();
  return (
    <div className="h-280 w-full overflow-auto">
      <Table<Book>
        {...table}
        columns={columns}
        rows={BOOKS}
        isLoading={false}
        render={tableRender<Book>()}
      />
    </div>
  );
}
