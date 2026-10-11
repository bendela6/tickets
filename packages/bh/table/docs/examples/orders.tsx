import { Table, sortRows, useTable, type Column } from '@bh/table';
import { BadgeColumn, NumberColumn, TextColumn, tableRender, type Tone } from '@bh/ui';

interface Order {
  id: string;
  number: number;
  customer: string;
  city: string;
  status: 'paid' | 'packed' | 'shipped' | 'returned';
  items: number;
  total: number;
}

const ORDERS: Order[] = [
  {
    id: 'a',
    number: 1042,
    customer: 'Ana',
    city: 'Lisbon',
    status: 'shipped',
    items: 3,
    total: 84.5,
  },
  {
    id: 'b',
    number: 1043,
    customer: 'Giorgi',
    city: 'Tbilisi',
    status: 'packed',
    items: 1,
    total: 19.9,
  },
  { id: 'c', number: 1044, customer: 'Marta', city: 'Porto', status: 'paid', items: 6, total: 212 },
  {
    id: 'd',
    number: 1045,
    customer: 'Luca',
    city: 'Turin',
    status: 'shipped',
    items: 2,
    total: 47.25,
  },
  {
    id: 'e',
    number: 1046,
    customer: 'Nino',
    city: 'Batumi',
    status: 'returned',
    items: 1,
    total: 32,
  },
  {
    id: 'f',
    number: 1047,
    customer: 'Inês',
    city: 'Braga',
    status: 'paid',
    items: 4,
    total: 126.4,
  },
  {
    id: 'g',
    number: 1048,
    customer: 'Pablo',
    city: 'Seville',
    status: 'shipped',
    items: 2,
    total: 58,
  },
  {
    id: 'h',
    number: 1049,
    customer: 'Elena',
    city: 'Valencia',
    status: 'packed',
    items: 5,
    total: 171.6,
  },
  {
    id: 'i',
    number: 1050,
    customer: 'Sofia',
    city: 'Milan',
    status: 'shipped',
    items: 1,
    total: 24.99,
  },
  {
    id: 'j',
    number: 1051,
    customer: 'Davit',
    city: 'Kutaisi',
    status: 'paid',
    items: 3,
    total: 66.3,
  },
];

const STATUS_TONE: Record<Order['status'], Tone> = {
  paid: 'blue',
  packed: 'yellow',
  shipped: 'green',
  returned: 'gray',
};

const euros = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
const itemCount = ORDERS.reduce((sum, order) => sum + order.items, 0);
const revenue = ORDERS.reduce((sum, order) => sum + order.total, 0);

const columns: Column<Order>[] = [
  {
    key: 'number',
    header: 'Order',
    // `value` sorts it; `render` draws it.
    value: (order) => order.number,
    render: (order) => <span className="font-mono">#{order.number}</span>,
    sortable: true,
    width: 96,
    resizable: false,
  },
  {
    key: 'customer',
    header: 'Customer',
    value: (order) => order.customer,
    as: TextColumn(),
    sortable: true,
    width: 'minmax(140px, 1fr)',
    minWidth: 120,
    footer: `${ORDERS.length} orders`,
  },
  // No `as` and no `render`: the value is drawn as text.
  { key: 'city', header: 'City', value: (order) => order.city, sortable: true, width: 130 },
  {
    key: 'status',
    header: 'Status',
    value: (order) => order.status,
    as: BadgeColumn<Order['status']>({ tone: (status) => STATUS_TONE[status] }),
    width: 120,
  },
  {
    key: 'items',
    header: 'Items',
    value: (order) => order.items,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 90,
    footer: <span className="font-mono">{itemCount}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    value: (order) => order.total,
    as: NumberColumn({ format: 'currency', currency: 'EUR' }),
    align: 'right',
    sortable: true,
    width: 120,
    footer: <span className="font-mono">{euros.format(revenue)}</span>,
  },
];

export function Orders() {
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
