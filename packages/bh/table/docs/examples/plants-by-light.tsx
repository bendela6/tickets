import { Table, sortRows, useTable, type Column, type TableGroup } from '@bh/table';
import { NumberColumn, TextColumn, tableRender } from '@bh/ui';

interface Plant {
  id: string;
  name: string;
  latin: string;
  light: 'sun' | 'part' | 'shade';
  /** Days between waterings. */
  water: number;
}

const PLANTS: Plant[] = [
  { id: '1', name: 'Rosemary', latin: 'Salvia rosmarinus', light: 'sun', water: 10 },
  { id: '2', name: 'Basil', latin: 'Ocimum basilicum', light: 'sun', water: 2 },
  { id: '3', name: 'Lavender', latin: 'Lavandula angustifolia', light: 'sun', water: 14 },
  { id: '4', name: 'Thyme', latin: 'Thymus vulgaris', light: 'sun', water: 12 },
  { id: '5', name: 'Tomato', latin: 'Solanum lycopersicum', light: 'sun', water: 2 },
  { id: '6', name: 'Geranium', latin: 'Pelargonium zonale', light: 'sun', water: 5 },
  { id: '7', name: 'Aloe', latin: 'Aloe vera', light: 'sun', water: 21 },
  { id: '8', name: 'Olive', latin: 'Olea europaea', light: 'sun', water: 9 },
  { id: '9', name: 'Mint', latin: 'Mentha spicata', light: 'part', water: 3 },
  { id: '10', name: 'Parsley', latin: 'Petroselinum crispum', light: 'part', water: 4 },
  { id: '11', name: 'Hydrangea', latin: 'Hydrangea macrophylla', light: 'part', water: 3 },
  { id: '12', name: 'Begonia', latin: 'Begonia semperflorens', light: 'part', water: 6 },
  { id: '13', name: 'Fuchsia', latin: 'Fuchsia magellanica', light: 'part', water: 4 },
  { id: '14', name: 'Hosta', latin: 'Hosta sieboldiana', light: 'shade', water: 5 },
  { id: '15', name: 'Fern', latin: 'Nephrolepis exaltata', light: 'shade', water: 3 },
  { id: '16', name: 'Peace lily', latin: 'Spathiphyllum wallisii', light: 'shade', water: 5 },
  { id: '17', name: 'Ivy', latin: 'Hedera helix', light: 'shade', water: 7 },
  { id: '18', name: 'Hellebore', latin: 'Helleborus niger', light: 'shade', water: 8 },
];

const LIGHT = [
  { key: 'sun', label: 'Full sun' },
  { key: 'part', label: 'Part shade' },
  { key: 'shade', label: 'Shade' },
] as const;

const columns: Column<Plant>[] = [
  {
    key: 'name',
    header: 'Plant',
    value: (p) => p.name,
    sortable: true,
    width: 'minmax(160px, 1fr)',
  },
  {
    key: 'latin',
    header: 'Latin name',
    value: (p) => p.latin,
    as: TextColumn({ mono: true }),
    width: 220,
  },
  {
    key: 'water',
    header: 'Water every (days)',
    value: (p) => p.water,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    sortable: true,
    width: 170,
  },
];

export function PlantsByLight() {
  // Its handlers include onCollapseChange, which gives every band a toggle.
  const table = useTable({ initialCollapsed: ['shade'] });
  const sorted = sortRows(PLANTS, table.state.sort, columns);
  // The page groups the rows; the table draws the bands. Sorting sorts within each.
  const groups: TableGroup<Plant>[] = LIGHT.map(({ key, label }) => {
    const rows = sorted.filter((plant) => plant.light === key);
    return {
      key,
      header: (
        <>
          <span>{label}</span>
          <span className="text-11 text-gray-9 font-mono">{rows.length}</span>
        </>
      ),
      rows,
    };
  });
  return (
    <div className="h-360 w-full overflow-auto">
      <Table<Plant>
        {...table}
        columns={columns}
        rows={[]}
        groups={groups}
        // The band of the group in view stays under the header as its rows scroll by.
        stickyGroupHeader
        isLoading={false}
        render={tableRender<Plant>()}
      />
    </div>
  );
}
