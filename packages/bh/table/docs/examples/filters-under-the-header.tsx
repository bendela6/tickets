import { useState } from 'react';
import { Table, sortRows, useTable, type Column } from '@bh/table';
import { Button, Combobox, Input, NumberColumn, tableRender } from '@bh/ui';

interface City {
  id: string;
  name: string;
  country: string;
  population: number;
}

const CITIES: City[] = [
  { id: '1', name: 'Lisbon', country: 'Portugal', population: 545_000 },
  { id: '2', name: 'Porto', country: 'Portugal', population: 232_000 },
  { id: '3', name: 'Braga', country: 'Portugal', population: 193_000 },
  { id: '4', name: 'Madrid', country: 'Spain', population: 3_332_000 },
  { id: '5', name: 'Barcelona', country: 'Spain', population: 1_620_000 },
  { id: '6', name: 'Valencia', country: 'Spain', population: 792_000 },
  { id: '7', name: 'Seville', country: 'Spain', population: 684_000 },
  { id: '8', name: 'Rome', country: 'Italy', population: 2_761_000 },
  { id: '9', name: 'Milan', country: 'Italy', population: 1_372_000 },
  { id: '10', name: 'Turin', country: 'Italy', population: 848_000 },
  { id: '11', name: 'Tbilisi', country: 'Georgia', population: 1_202_000 },
  { id: '12', name: 'Batumi', country: 'Georgia', population: 169_000 },
  { id: '13', name: 'Kutaisi', country: 'Georgia', population: 131_000 },
];

const COUNTRIES = [
  { value: '', label: 'Any country' },
  ...['Georgia', 'Italy', 'Portugal', 'Spain'].map((country) => {
    return { value: country, label: country };
  }),
];

export function FiltersUnderTheHeader() {
  const table = useTable();
  // The page owns the filters: the table only shows where they sit.
  const [name, setName] = useState('');
  const [country, setCountry] = useState<string | null>('');
  const [large, setLarge] = useState(false);

  const columns: Column<City>[] = [
    {
      key: 'name',
      header: 'City',
      value: (city) => city.name,
      sortable: true,
      width: 'minmax(160px, 1fr)',
      filter: (
        <Input
          size="xs"
          className="w-full"
          aria-label="Filter cities"
          placeholder="Name contains…"
          value={name}
          onChange={setName}
        />
      ),
    },
    {
      key: 'country',
      header: 'Country',
      value: (city) => city.country,
      sortable: true,
      width: 160,
      filter: (
        <Combobox
          searchable={false}
          size="xs"
          className="w-full"
          aria-label="Filter countries"
          value={country}
          onChange={setCountry}
          options={COUNTRIES}
        />
      ),
    },
    {
      key: 'population',
      header: 'Population',
      value: (city) => city.population,
      as: NumberColumn({ format: 'integer' }),
      align: 'right',
      sortable: true,
      width: 170,
      // A click on it never sorts; Alt+↓ on the focused header clicks it.
      headerAccessory: (
        <Button
          variant="ghost"
          size="xs"
          tone={large ? 'primary' : 'neutral'}
          icon="filter"
          label="Only cities over a million"
          aria-pressed={large}
          onClick={() => setLarge(!large)}
        />
      ),
    },
  ];

  const rows = CITIES.filter((city) => {
    return (
      city.name.toLowerCase().includes(name.trim().toLowerCase()) &&
      (!country || city.country === country) &&
      (!large || city.population > 1_000_000)
    );
  });
  const clear = () => {
    setName('');
    setCountry('');
    setLarge(false);
  };

  return (
    <div className="h-360 w-full overflow-auto">
      <Table<City>
        {...table}
        columns={columns}
        rows={sortRows(rows, table.state.sort, columns)}
        isLoading={false}
        isFiltered={rows.length < CITIES.length}
        onClearFilters={clear}
        render={tableRender<City>()}
      />
    </div>
  );
}
