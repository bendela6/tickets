import { Table, sortRows, useTable, type Column } from '@bh/table';
import {
  ActionsColumn,
  BadgeColumn,
  DateColumn,
  NumberColumn,
  tableRender,
  type Tone,
} from '@bh/ui';

interface Order {
  id: string;
  number: number;
  customer: string;
  city: string;
  country: string;
  status: 'paid' | 'packed' | 'shipped' | 'returned';
  items: number;
  subtotal: number;
  shipping: number;
  placed: string;
}

const CUSTOMERS = ['Ana', 'Giorgi', 'Marta', 'Luca', 'Nino', 'Inês', 'Pablo', 'Elena', 'Sofia'];
const PLACES = [
  ['Lisbon', 'Portugal'],
  ['Tbilisi', 'Georgia'],
  ['Porto', 'Portugal'],
  ['Turin', 'Italy'],
  ['Batumi', 'Georgia'],
  ['Seville', 'Spain'],
  ['Milan', 'Italy'],
] as const;
const STATUSES = ['paid', 'packed', 'shipped', 'shipped', 'returned'] as const;

const ORDERS: Order[] = Array.from({ length: 30 }, (_, i) => {
  const [city, country] = PLACES[i % PLACES.length] ?? PLACES[0];
  return {
    id: String(i),
    number: 1042 + i,
    customer: CUSTOMERS[i % CUSTOMERS.length] ?? 'Ana',
    city,
    country,
    status: STATUSES[i % STATUSES.length] ?? 'paid',
    items: (i % 5) + 1,
    subtotal: 18 + ((i * 37) % 160),
    shipping: i % 4 === 0 ? 0 : 4.9,
    placed: new Date(Date.UTC(2026, 8, 30 - i, 10, 30)).toISOString(),
  };
});

const STATUS_TONE: Record<Order['status'], Tone> = {
  paid: 'blue',
  packed: 'yellow',
  shipped: 'green',
  returned: 'gray',
};

const euros = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
const sum = (pick: (order: Order) => number) => ORDERS.reduce((total, o) => total + pick(o), 0);
const money = NumberColumn({ format: 'currency', currency: 'EUR' });

// Every column has a width in pixels: a frozen column's place is the sum of
// the frozen widths beside it.
const columns: Column<Order>[] = [
  {
    key: 'number',
    header: 'Order',
    value: (o) => o.number,
    render: (o) => <span className="font-mono">#{o.number}</span>,
    sortable: true,
    width: 100,
    pinned: 'left',
    footer: `${ORDERS.length} orders`,
  },
  {
    key: 'customer',
    header: 'Customer',
    value: (o) => o.customer,
    sortable: true,
    width: 140,
    pinned: 'left',
  },
  { key: 'city', header: 'City', value: (o) => o.city, sortable: true, width: 140 },
  { key: 'country', header: 'Country', value: (o) => o.country, sortable: true, width: 140 },
  {
    key: 'status',
    header: 'Status',
    value: (o) => o.status,
    as: BadgeColumn<Order['status']>({ tone: (status) => STATUS_TONE[status] }),
    width: 130,
  },
  {
    key: 'items',
    header: 'Items',
    value: (o) => o.items,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 100,
    footer: <span className="font-mono">{sum((o) => o.items)}</span>,
  },
  {
    key: 'subtotal',
    header: 'Subtotal',
    value: (o) => o.subtotal,
    as: money,
    align: 'right',
    sortable: true,
    width: 130,
    footer: <span className="font-mono">{euros.format(sum((o) => o.subtotal))}</span>,
  },
  {
    key: 'shipping',
    header: 'Shipping',
    value: (o) => o.shipping,
    as: money,
    align: 'right',
    width: 120,
    footer: <span className="font-mono">{euros.format(sum((o) => o.shipping))}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    value: (o) => o.subtotal + o.shipping,
    as: money,
    align: 'right',
    sortable: true,
    width: 130,
    footer: <span className="font-mono">{euros.format(sum((o) => o.subtotal + o.shipping))}</span>,
  },
  {
    key: 'placed',
    header: 'Placed',
    value: (o) => o.placed,
    as: DateColumn(),
    sortable: true,
    width: 150,
  },
  {
    key: 'actions',
    header: 'Actions',
    as: ActionsColumn({ items: [{ icon: 'pencil', label: 'Edit order', onClick: () => {} }] }),
    align: 'right',
    width: 80,
    resizable: false,
    pinned: 'right',
  },
];

export function FrozenColumns() {
  const table = useTable();
  return (
    <div className="h-360 w-full overflow-auto">
      <Table<Order>
        {...table}
        columns={columns}
        rows={sortRows(ORDERS, table.state.sort, columns)}
        isLoading={false}
        render={tableRender<Order>()}
      />
    </div>
  );
}
