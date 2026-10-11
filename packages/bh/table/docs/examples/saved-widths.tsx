import { Table, useTable, type Column } from '@bh/table';
import { NumberColumn, TextColumn, tableRender } from '@bh/ui';

interface Plant {
  id: string;
  name: string;
  latin: string;
  light: string;
  /** Days between waterings. */
  water: number;
}

const PLANTS: Plant[] = [
  { id: '1', name: 'Monstera', latin: 'Monstera deliciosa', light: 'Bright, indirect', water: 7 },
  { id: '2', name: 'Snake plant', latin: 'Dracaena trifasciata', light: 'Any', water: 21 },
  { id: '3', name: 'Rosemary', latin: 'Salvia rosmarinus', light: 'Full sun', water: 10 },
  { id: '4', name: 'Peace lily', latin: 'Spathiphyllum wallisii', light: 'Shade', water: 5 },
  { id: '5', name: 'Fiddle-leaf fig', latin: 'Ficus lyrata', light: 'Bright, indirect', water: 8 },
  { id: '6', name: 'Basil', latin: 'Ocimum basilicum', light: 'Full sun', water: 2 },
  { id: '7', name: 'Pothos', latin: 'Epipremnum aureum', light: 'Any', water: 9 },
  { id: '8', name: 'Lavender', latin: 'Lavandula angustifolia', light: 'Full sun', water: 14 },
];

const columns: Column<Plant>[] = [
  // Flexible, and never narrower than 120 however it is dragged.
  {
    key: 'name',
    header: 'Plant',
    value: (p) => p.name,
    width: 'minmax(160px, 1fr)',
    minWidth: 120,
  },
  {
    key: 'latin',
    header: 'Latin name',
    value: (p) => p.latin,
    as: TextColumn({ mono: true }),
    width: 200,
  },
  { key: 'light', header: 'Light', value: (p) => p.light, width: 150 },
  {
    key: 'water',
    header: 'Water every (days)',
    value: (p) => p.water,
    as: NumberColumn({ format: 'integer' }),
    align: 'right',
    width: 160,
    // Fixed: no handle on this one.
    resizable: false,
  },
];

const STORAGE_KEY = 'docs:plants';

/** What is saved now, read back. Storage may be turned off; then nothing is. */
function saved(): string {
  try {
    return localStorage.getItem(`${STORAGE_KEY}:widths`) ?? 'nothing yet';
  } catch {
    return 'nothing: storage is off';
  }
}

export function SavedWidths() {
  const table = useTable({ storageKey: STORAGE_KEY });
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-280 w-full overflow-auto">
        <Table<Plant>
          {...table}
          columns={columns}
          rows={PLANTS}
          isLoading={false}
          render={tableRender<Plant>()}
        />
      </div>
      <code className="text-12/17 text-gray-11 font-mono">
        {STORAGE_KEY}:widths = {saved()}
      </code>
    </div>
  );
}
