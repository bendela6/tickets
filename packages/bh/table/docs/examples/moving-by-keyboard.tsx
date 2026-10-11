import { useState } from 'react';
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { ActionsColumn, NumberColumn, tableRender } from '@bh/ui';

interface Order {
  id: string;
  number: number;
  customer: string;
  city: string;
  total: number;
}

const ORDERS: Order[] = [
  { id: 'a', number: 1042, customer: 'Ana', city: 'Lisbon', total: 84.5 },
  { id: 'b', number: 1043, customer: 'Giorgi', city: 'Tbilisi', total: 19.9 },
  { id: 'c', number: 1044, customer: 'Marta', city: 'Porto', total: 212 },
  { id: 'd', number: 1045, customer: 'Luca', city: 'Turin', total: 47.25 },
  { id: 'e', number: 1046, customer: 'Nino', city: 'Batumi', total: 32 },
  { id: 'f', number: 1047, customer: 'Inês', city: 'Braga', total: 126.4 },
  { id: 'g', number: 1048, customer: 'Pablo', city: 'Seville', total: 58 },
  { id: 'h', number: 1049, customer: 'Elena', city: 'Valencia', total: 171.6 },
];

export function MovingByKeyboard() {
  const table = useTable();
  const [said, setSaid] = useState('Tab into the table, then use the arrows.');

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Order',
      value: (order) => order.number,
      render: (order) => <span className="font-mono">#{order.number}</span>,
      sortable: true,
      width: 100,
    },
    {
      key: 'customer',
      header: 'Customer',
      value: (order) => order.customer,
      sortable: true,
      width: 'minmax(140px, 1fr)',
    },
    { key: 'city', header: 'City', value: (order) => order.city, sortable: true, width: 130 },
    {
      key: 'total',
      header: 'Total',
      value: (order) => order.total,
      as: NumberColumn({ format: 'currency', currency: 'EUR' }),
      align: 'right',
      sortable: true,
      width: 120,
    },
    {
      key: 'actions',
      header: 'Actions',
      // Enter or F2 on this cell steps into its buttons; Escape steps back out.
      as: ActionsColumn({
        items: [
          {
            icon: 'copy',
            label: 'Copy order number',
            onClick: (row) => setSaid(`Copied #${(row as Order).number}.`),
          },
          {
            icon: 'pencil',
            label: 'Edit order',
            onClick: (row) => setSaid(`Editing #${(row as Order).number}.`),
          },
        ],
      }),
      align: 'right',
      width: 100,
      resizable: false,
    },
  ];

  const focused = table.state.focused;
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-320 w-full overflow-auto">
        <Table<Order>
          {...table}
          columns={columns}
          rows={sortRows(ORDERS, table.state.sort, columns)}
          isLoading={false}
          // Enter on a cell with no button of its own.
          onRowActivate={(order) => setSaid(`Opened #${order.number}.`)}
          render={tableRender<Order>()}
        />
      </div>
      <p className="text-12/17 text-gray-11 font-mono">
        {focused ? `focused: row ${focused.rowIndex}, ${focused.columnKey}. ` : ''}
        {said}
      </p>
    </div>
  );
}
