// The indexes editor — CREATE INDEX rows: name, columns (composite order
// significant — ColumnMultiSelect's tick order, same reasoning as the
// constraints editor's pk/unique rows, surfaced the same way as numbered
// chips), per-column ASC/DESC + NULLS FIRST/LAST, method (btree · hash · gin
// · gist · brin), a WHERE predicate that makes the index partial, and unique
// (a unique INDEX — a different Postgres object from a UNIQUE constraint on
// the Constraints tab; the caption below says so, since the same English
// word means two different things one tab apart).
//
// Indexes are not constraints (no PK-count/expression rules apply, and a
// column can be a raw SQL expression rather than a name — see IndexColumn),
// so `indexCardError` below only mirrors the two rules that ARE visible from
// this entity's own draft (duplicate name, empty column list) — the same
// "presentation-only mirror of the engine, not a second copy of it" as
// constraints-editor's `cardError` (see its own header comment).
// apply-model-edit's validateConstraints index pass remains the actual
// backstop.

import type { IndexColumn, TableIndex } from '../../engine/model/types';
import { cn } from '../../ui/cn';
import { ColumnMultiSelect } from './column-multi-select';

const card = cn('flex flex-col gap-2 rounded-xl border border-gray-600 bg-gray-900 p-3');
const input = cn('rounded border border-gray-600 bg-gray-900 px-2 py-1', 'text-xs text-gray-50');
const inputInvalid = cn('rounded border border-red-600 bg-red-950 px-2 py-1', 'text-xs text-red-200');
const selectCls = cn(input, 'shrink-0');
const addBtn = 'rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800';
const iconBtn = cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', 'text-gray-400 hover:bg-gray-800 hover:text-gray-50');
const errMsg = cn('rounded border border-red-600 bg-red-950 px-2 py-1', 'font-mono text-xs text-red-400');
const colRow = cn('flex items-center gap-1 rounded border border-gray-600 bg-gray-900', 'px-1 py-1');
const orderBtnOn = cn('rounded px-1 font-mono text-3xs font-semibold uppercase', 'bg-blue-600 text-gray-50');
const orderBtnOff = 'rounded px-1 font-mono text-3xs uppercase text-gray-400 hover:text-gray-200';

const METHODS = ['btree', 'hash', 'gin', 'gist', 'brin'] as const;

// Collision-safe the same way constraints-editor's nextId is: a hand-written
// file can carry a non-numeric index id, and that must contribute 0 to the
// max (never NaN, never a crash, never a collision with a real `iN`).
function nextId(indexes: TableIndex[]): string {
  const max = indexes.reduce((m, ix) => Math.max(m, Number(ix.id.replace(/^i/, '')) || 0), 0);
  return `i${max + 1}`;
}

function cycleOrder(order: IndexColumn['order']): IndexColumn['order'] {
  if (order === null) return 'asc';
  if (order === 'asc') return 'desc';
  return null;
}

function indexCardError(ix: TableIndex, all: TableIndex[], ownColumns: string[]): string | null {
  if (ix.name && all.some((o) => o.id !== ix.id && o.name === ix.name)) return `Duplicate index name "${ix.name}".`;
  if (ix.columns.length === 0) return 'Must reference at least one column.';
  for (const c of ix.columns) {
    if (!c.isExpression && !ownColumns.includes(c.expression)) return `Unknown column "${c.expression}".`;
  }
  return null;
}

interface IndexesEditorProps {
  columns: string[];
  indexes: TableIndex[];
  onChange: (next: TableIndex[]) => void;
}

// This editor only ever TICKS/UNTICKS a plain column reference via
// ColumnMultiSelect (no way to author an expression index column yet), but
// the model may already carry a fuller drizzle-shaped IndexColumn on any of
// them (hand-authored/imported) — so ColumnMultiSelect's onChange (the whole
// tick-ordered array of column NAMES) is merged against the PRIOR columns,
// not rebuilt from scratch: a still-ticked name keeps its existing
// IndexColumn object verbatim (preserving order/nulls/opClass/isExpression),
// a newly-ticked name gets a fresh default one, and an unticked name is
// dropped. A prior version flattened every entry into a bare default column
// on every change, so ticking (or unticking) any ONE column of a composite
// index silently wiped order/nulls/opClass from every OTHER, untouched column
// of that same index.
const toNames = (cols: IndexColumn[]): string[] => cols.map((c) => c.expression);
const toIndexColumns = (names: string[], prior: IndexColumn[]): IndexColumn[] => {
  const priorByExpression = new Map(prior.map((c) => [c.expression, c] as const));
  return names.map(
    (expression) => priorByExpression.get(expression) ?? { expression, isExpression: false, order: null, nulls: null, opClass: null },
  );
};

export function IndexesEditor({ columns, indexes, onChange }: IndexesEditorProps) {
  const add = () =>
    onChange([...indexes, { id: nextId(indexes), name: '', columns: [], unique: false, method: null, only: false, where: null }]);
  const patch = (i: number, next: Partial<TableIndex>) => onChange(indexes.map((ix, j) => (j === i ? { ...ix, ...next } : ix)));
  const patchColumn = (i: number, ci: number, next: Partial<IndexColumn>) =>
    patch(i, { columns: indexes[i]!.columns.map((c, j) => (j === ci ? { ...c, ...next } : c)) });
  const remove = (i: number) => onChange(indexes.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-2">
      {indexes.map((ix, i) => {
        const n = i + 1;
        const err = indexCardError(ix, indexes, columns);
        const nameErr = err != null && err.startsWith('Duplicate index name');
        const colsErr = err === 'Must reference at least one column.';

        return (
          <div key={ix.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={cn(nameErr ? inputInvalid : input, 'w-28')}
                placeholder="name"
                aria-label={`Index ${n} name`}
                value={ix.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <ColumnMultiSelect
                options={columns}
                value={toNames(ix.columns)}
                onChange={(v) => patch(i, { columns: toIndexColumns(v, ix.columns) })}
                label={`Index ${n} column`}
                invalid={colsErr}
              />
              <select
                className={selectCls}
                aria-label={`Index ${n} method`}
                value={ix.method ?? 'btree'}
                onChange={(e) => patch(i, { method: e.target.value === 'btree' ? null : e.target.value })}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'btree' ? 'btree (default)' : m}
                  </option>
                ))}
              </select>
              <button type="button" className={cn(iconBtn, 'ml-auto')} aria-label={`Remove index ${n}`} onClick={() => remove(i)}>
                ✕
              </button>
            </div>

            {ix.columns.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {ix.columns.map((c, ci) => (
                  <div key={`${c.expression}-${ci}`} className={colRow}>
                    <span className="px-1 font-mono text-3xs text-gray-500">{ci + 1}</span>
                    <span className="px-1 text-xs text-gray-200">{c.isExpression ? `expr: ${c.expression}` : c.expression}</span>
                    <button
                      type="button"
                      aria-label={`Index ${n} column ${c.expression} order`}
                      className={c.order ? orderBtnOn : orderBtnOff}
                      onClick={() => patchColumn(i, ci, { order: cycleOrder(c.order) })}
                    >
                      {c.order ?? 'asc'}
                    </button>
                    <select
                      className={selectCls}
                      aria-label={`Index ${n} column ${c.expression} nulls`}
                      value={c.nulls ?? ''}
                      onChange={(e) => patchColumn(i, ci, { nulls: (e.target.value || null) as IndexColumn['nulls'] })}
                    >
                      <option value="">nulls –</option>
                      <option value="first">nulls first</option>
                      <option value="last">nulls last</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                className={cn(input, 'grow')}
                placeholder="— full index"
                aria-label={`Index ${n} where`}
                value={ix.where ?? ''}
                onChange={(e) => patch(i, { where: e.target.value ? e.target.value : null })}
              />
            </div>

            <label className="flex items-center gap-1 text-2xs text-gray-400">
              <input
                type="checkbox"
                aria-label={`Index ${n} unique`}
                checked={ix.unique}
                onChange={(e) => patch(i, { unique: e.target.checked })}
              />
              unique index — separate from a UNIQUE constraint on the Constraints tab
            </label>

            {err && <p className={errMsg}>{err}</p>}
          </div>
        );
      })}

      <button type="button" className={addBtn} onClick={add}>
        + Add index
      </button>
    </div>
  );
}
