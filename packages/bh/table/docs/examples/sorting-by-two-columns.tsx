import { Table, sortRows, useTable, type Column } from '@bh/table';
import { NumberColumn, tableRender } from '@bh/ui';

interface City {
  id: string;
  name: string;
  country: string;
  population: number;
  /** Metres above the sea; not every city has one on record here. */
  elevation: number | null;
}

const CITIES: City[] = [
  { id: '1', name: 'Lisbon', country: 'Portugal', population: 545_000, elevation: 100 },
  { id: '2', name: 'Porto', country: 'Portugal', population: 232_000, elevation: null },
  { id: '3', name: 'Coimbra', country: 'Portugal', population: 140_000, elevation: 75 },
  { id: '4', name: 'Madrid', country: 'Spain', population: 3_332_000, elevation: 657 },
  { id: '5', name: 'Seville', country: 'Spain', population: 684_000, elevation: 7 },
  { id: '6', name: 'Granada', country: 'Spain', population: 228_000, elevation: 738 },
  { id: '7', name: 'Rome', country: 'Italy', population: 2_761_000, elevation: 21 },
  { id: '8', name: 'Turin', country: 'Italy', population: 848_000, elevation: 239 },
  { id: '9', name: 'Bologna', country: 'Italy', population: 392_000, elevation: null },
  { id: '10', name: 'Tbilisi', country: 'Georgia', population: 1_202_000, elevation: 490 },
  { id: '11', name: 'Kutaisi', country: 'Georgia', population: 131_000, elevation: 125 },
  { id: '12', name: 'Batumi', country: 'Georgia', population: 169_000, elevation: 3 },
];

const columns: Column<City>[] = [
  { key: 'country', header: 'Country', value: (city) => city.country, sortable: true, width: 150 },
  {
    key: 'name',
    header: 'City',
    value: (city) => city.name,
    sortable: true,
    width: 'minmax(140px, 1fr)',
  },
  {
    key: 'population',
    header: 'Population',
    value: (city) => city.population,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 150,
  },
  {
    key: 'elevation',
    header: 'Elevation (m)',
    value: (city) => city.elevation,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 150,
  },
];

export function SortingByTwoColumns() {
  const table = useTable({ initialSort: [{ field: 'country', direction: 'asc' }] });
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-320 w-full overflow-auto">
        <Table<City>
          {...table}
          columns={columns}
          rows={sortRows(CITIES, table.state.sort, columns)}
          isLoading={false}
          render={tableRender<City>()}
        />
      </div>
      <code className="text-12/17 text-gray-11 font-mono">
        sort: {JSON.stringify(table.state.sort)}
      </code>
    </div>
  );
}
