import { useEffect, useRef, useState } from 'react';
import { Table, useTable, type Column } from '@bh/table';
import { NumberColumn, rowHeightFor, tableRender } from '@bh/ui';

interface Parcel {
  id: string;
  code: string;
  from: string;
  to: string;
  /** In grams. */
  weight: number;
}

const CITIES = ['Lisbon', 'Porto', 'Madrid', 'Seville', 'Rome', 'Turin', 'Tbilisi', 'Batumi'];
const TOTAL = 10_000;
const PAGE = 200;

/** One page of parcels, made up from its place in the list. */
function page(start: number): Parcel[] {
  return Array.from({ length: Math.min(PAGE, TOTAL - start) }, (_, offset) => {
    const i = start + offset;
    return {
      id: String(i),
      code: `PX-${String(100_000 + i * 7)}`,
      from: CITIES[i % CITIES.length] ?? 'Lisbon',
      to: CITIES[(i * 3 + 1) % CITIES.length] ?? 'Porto',
      weight: 120 + ((i * 263) % 9_800),
    };
  });
}

const columns: Column<Parcel>[] = [
  { key: 'code', header: 'Parcel', value: (p) => p.code, width: 140 },
  { key: 'from', header: 'From', value: (p) => p.from, width: 'minmax(120px, 1fr)' },
  { key: 'to', header: 'To', value: (p) => p.to, width: 'minmax(120px, 1fr)' },
  {
    key: 'weight',
    header: 'Weight (g)',
    value: (p) => p.weight,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 130,
  },
];

export function LoadingMoreAsYouScroll() {
  const table = useTable();
  const [parcels, setParcels] = useState(() => page(0));
  const [fetching, setFetching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Called once the last rows come into view. A real page would fetch here;
  // this one makes the next page up after a moment.
  const more = () => {
    if (fetching || parcels.length >= TOTAL) {
      return;
    }
    setFetching(true);
    timer.current = setTimeout(() => {
      setParcels((loaded) => [...loaded, ...page(loaded.length)]);
      setFetching(false);
    }, 600);
  };

  return (
    <div className="h-360 w-full overflow-auto">
      <Table<Parcel>
        {...table}
        columns={columns}
        rows={parcels}
        isLoading={false}
        rowHeight={rowHeightFor('compact')}
        onEndReached={more}
        status={`${parcels.length.toLocaleString()} of ${TOTAL.toLocaleString()} parcels${fetching ? ', loading more…' : ''}`}
        render={tableRender<Parcel>()}
      />
    </div>
  );
}
