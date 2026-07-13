// The table modal's column editor. Pure controlled grid: `table-modal.tsx`
// owns the draft array and all validation; this component only renders rows
// and reports whole-array patches back up via onChange.
//
// There is no Role / Ref-table / Ref-field column here any more. Connections
// used to be derived from a field's role:'fk' + ref (toggle a row to FK, pick
// a ref/field, get an edge) — but badges and edges are derived from the
// table's `constraints` now (see column-roles.ts / derive-relationships.ts),
// and upsertEntity carries constraints through the edit VERBATIM rather than
// re-deriving them from field role/ref (see apply-model-edit's header
// comment) — re-deriving them here would silently wipe a real constraints-
// authored table's keys and every edge attached to them on the very next
// Save. A real constraints editor is a later task; until then, keys and
// references are display-only, set by the file, not this grid.
//
// The type cell is no longer free text — TypeCell is a real Postgres type
// picker (grouped <select> + param inputs + a custom… escape hatch); columns
// are still STORED as plain strings ("varchar(255)"), TypeCell is just the
// codec around that string. `nullable`/`default` are new editable columns
// (previously carried through untouched — see EditField's own field comment).

import type { EditField } from '../../engine/model/apply-model-edit';
import { cn } from '../../ui/cn';
import { TypeCell } from './type-cell';

const cellInput = cn('w-full rounded border border-gray-600 bg-gray-900 px-1 py-1', 'font-mono text-xs text-gray-50');
const iconBtn = cn(
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400',
  'hover:bg-gray-800 hover:text-gray-50 disabled:pointer-events-none disabled:opacity-30',
);
const colHead = 'text-2xs font-semibold uppercase tracking-wide text-gray-400';
// One width per column, shared by the header cell and its inputs so they stay
// aligned. They grow into the wide modal, so the grid never scrolls sideways.
const COL = {
  name: 'w-32 grow',
  type: 'w-40 grow',
  nullable: 'w-10 shrink-0',
  default: 'w-24 grow',
  note: 'w-32 grow',
} as const;

interface ColumnsGridProps {
  columns: EditField[];
  onChange: (columns: EditField[]) => void;
}

export function ColumnsGrid({ columns, onChange }: ColumnsGridProps) {
  const patch = (index: number, next: Partial<EditField>) => {
    onChange(columns.map((c, i) => (i === index ? { ...c, ...next } : c)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= columns.length) return;
    const next = columns.slice();
    const here = next[index]!;
    const there = next[j]!;
    next[index] = there;
    next[j] = here;
    onChange(next);
  };

  const remove = (index: number) => onChange(columns.filter((_, i) => i !== index));

  const addColumn = () =>
    onChange([...columns, { name: '', type: 'text', title: null, description: null, nullable: true, default: null }]);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-gray-600">
        <div>
          <div className="flex items-center gap-2 border-b border-gray-600 bg-gray-900 px-2 py-1">
            <span className={cn(colHead, COL.name)}>Name</span>
            <span className={cn(colHead, COL.type)}>Type</span>
            <span className={cn(colHead, COL.nullable)}>Null</span>
            <span className={cn(colHead, COL.default)}>Default</span>
            <span className={cn(colHead, COL.note)}>Note</span>
            <span className="w-20 shrink-0" aria-hidden />
          </div>
          {columns.map((c, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-gray-600/50 px-2 py-1 last:border-0">
              <input
                className={cn(cellInput, COL.name)}
                aria-label={`Column ${i + 1} name`}
                value={c.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <div className={cn('flex items-center', COL.type)}>
                <TypeCell value={c.type} onChange={(type) => patch(i, { type })} />
              </div>
              <input
                type="checkbox"
                className={cn(COL.nullable, 'shrink-0')}
                aria-label={`Column ${i + 1} nullable`}
                checked={c.nullable}
                onChange={(e) => patch(i, { nullable: e.target.checked })}
              />
              <input
                className={cn(cellInput, COL.default)}
                aria-label={`Column ${i + 1} default`}
                value={c.default ?? ''}
                onChange={(e) => patch(i, { default: e.target.value ? e.target.value : null })}
              />
              <input
                className={cn(cellInput, COL.note)}
                aria-label={`Column ${i + 1} note`}
                value={c.description ?? ''}
                onChange={(e) => patch(i, { description: e.target.value })}
              />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Move column ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Move column ${i + 1} down`}
                  disabled={i === columns.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button type="button" className={iconBtn} aria-label={`Remove column ${i + 1}`} onClick={() => remove(i)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
          onClick={addColumn}
        >
          Add column
        </button>
        <p className="text-2xs text-gray-400">Keys and references come from the table's constraints — not editable here yet.</p>
      </div>
    </div>
  );
}
