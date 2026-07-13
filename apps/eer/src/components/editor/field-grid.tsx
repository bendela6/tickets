// The table modal's field editor. Pure controlled grid: `table-modal.tsx` owns
// the draft array and all validation; this component only renders rows and
// reports whole-array patches back up via onChange.
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

import type { EditField } from '../../engine/model/apply-model-edit';
import { cn } from '../../ui/cn';

const cellInput = cn('w-full rounded border border-gray-600 bg-gray-900 px-1 py-1', 'font-mono text-xs text-gray-50');
const iconBtn = cn(
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400',
  'hover:bg-gray-800 hover:text-gray-50 disabled:pointer-events-none disabled:opacity-30',
);
const colHead = 'text-2xs font-semibold uppercase tracking-wide text-gray-400';
// One width per column, shared by the header cell and its inputs so they stay
// aligned. They grow into the wide modal, so the grid never scrolls sideways.
const COL = {
  name: 'w-40 grow',
  type: 'w-24 grow',
  note: 'w-40 grow',
} as const;

interface FieldGridProps {
  fields: EditField[];
  onChange: (fields: EditField[]) => void;
}

export function FieldGrid({ fields, onChange }: FieldGridProps) {
  const patch = (index: number, next: Partial<EditField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...next } : f)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= fields.length) return;
    const next = fields.slice();
    const here = next[index]!;
    const there = next[j]!;
    next[index] = there;
    next[j] = here;
    onChange(next);
  };

  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));

  const addField = () =>
    onChange([...fields, { name: '', type: 'text', title: null, description: null, nullable: true, default: null }]);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-gray-600">
        <div>
          <div className="flex items-center gap-2 border-b border-gray-600 bg-gray-900 px-2 py-1">
            <span className={cn(colHead, COL.name)}>Name</span>
            <span className={cn(colHead, COL.type)}>Type</span>
            <span className={cn(colHead, COL.note)}>Note</span>
            <span className="w-20 shrink-0" aria-hidden />
          </div>
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-gray-600/50 px-2 py-1 last:border-0">
              <input
                className={cn(cellInput, COL.name)}
                aria-label={`Field ${i + 1} name`}
                value={f.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <input
                className={cn(cellInput, COL.type)}
                aria-label={`Field ${i + 1} type`}
                value={f.type}
                onChange={(e) => patch(i, { type: e.target.value })}
              />
              <input
                className={cn(cellInput, COL.note)}
                aria-label={`Field ${i + 1} note`}
                value={f.description ?? ''}
                onChange={(e) => patch(i, { description: e.target.value })}
              />
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" className={iconBtn} aria-label={`Move field ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Move field ${i + 1} down`}
                  disabled={i === fields.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button type="button" className={iconBtn} aria-label={`Remove field ${i + 1}`} onClick={() => remove(i)}>
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
          onClick={addField}
        >
          Add field
        </button>
        <p className="text-2xs text-gray-400">Keys and references come from the table's constraints — not editable here yet.</p>
      </div>
    </div>
  );
}
