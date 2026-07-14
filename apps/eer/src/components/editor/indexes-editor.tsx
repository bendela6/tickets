// The indexes editor — CREATE INDEX rows: name, columns (composite order
// significant — ColumnMultiSelect's tick order, same reasoning as the
// constraints editor's pk/unique rows), unique. Indexes are not constraints
// (no PK-count/expression rules apply), so this editor is deliberately
// simpler than ConstraintsEditor — apply-model-edit's validateConstraints
// index pass (duplicate names, unknown columns) is still the backstop.

import type { IndexColumn, TableIndex } from '../../engine/model/types';
import { cn } from '../../ui/cn';
import { ColumnMultiSelect } from './column-multi-select';

const input = cn('rounded border border-gray-600 bg-gray-900 px-2 py-1', 'text-xs text-gray-50');
const addBtn = 'rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800';
const iconBtn = cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', 'text-gray-400 hover:bg-gray-800 hover:text-gray-50');

// Collision-safe the same way constraints-editor's nextId is: a hand-written
// file can carry a non-numeric index id, and that must contribute 0 to the
// max (never NaN, never a crash, never a collision with a real `iN`).
function nextId(indexes: TableIndex[]): string {
  const max = indexes.reduce((m, ix) => Math.max(m, Number(ix.id.replace(/^i/, '')) || 0), 0);
  return `i${max + 1}`;
}

interface IndexesEditorProps {
  columns: string[];
  indexes: TableIndex[];
  onChange: (next: TableIndex[]) => void;
}

// This editor only ever authors a plain column reference (no expression,
// ordering, opClass, method/only/where yet — see IndexColumn/TableIndex in
// types.ts) — a simple string list is all the UI needs, converted at the
// boundary so the model can still carry the fuller drizzle-shaped index a
// hand-authored or imported file may already have.
const toNames = (cols: IndexColumn[]): string[] => cols.map((c) => c.expression);
const toIndexColumns = (names: string[]): IndexColumn[] =>
  names.map((expression) => ({ expression, isExpression: false, order: null, nulls: null, opClass: null }));

export function IndexesEditor({ columns, indexes, onChange }: IndexesEditorProps) {
  const add = () =>
    onChange([...indexes, { id: nextId(indexes), name: '', columns: [], unique: false, method: null, only: false, where: null }]);
  const patch = (i: number, next: Partial<TableIndex>) => onChange(indexes.map((ix, j) => (j === i ? { ...ix, ...next } : ix)));
  const remove = (i: number) => onChange(indexes.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-2">
      {indexes.map((ix, i) => {
        const n = i + 1;
        return (
          <div key={ix.id} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-600 p-2">
            <input
              className={cn(input, 'w-28')}
              placeholder="name"
              aria-label={`Index ${n} name`}
              value={ix.name}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <ColumnMultiSelect
              options={columns}
              value={toNames(ix.columns)}
              onChange={(v) => patch(i, { columns: toIndexColumns(v) })}
              label={`Index ${n} column`}
            />
            <label className="flex items-center gap-1 text-2xs text-gray-400">
              <input
                type="checkbox"
                aria-label={`Index ${n} unique`}
                checked={ix.unique}
                onChange={(e) => patch(i, { unique: e.target.checked })}
              />
              unique
            </label>
            <button type="button" className={cn(iconBtn, 'ml-auto')} aria-label={`Remove index ${n}`} onClick={() => remove(i)}>
              ✕
            </button>
          </div>
        );
      })}

      <button type="button" className={addBtn} onClick={add}>
        + Add index
      </button>
    </div>
  );
}
