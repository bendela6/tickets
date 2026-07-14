// The constraints editor — the ONLY place a user creates a PRIMARY KEY,
// UNIQUE, CHECK, or FOREIGN KEY constraint. A FOREIGN KEY is now the only way
// to draw an edge between two tables (see derive-relationships.ts): the row
// below is bookkeeping around it, not the edge itself — hence its badge is
// the only one painted blue, and its card says so inline (top-right).
//
// Engine-side validation (apply-model-edit's validateConstraints) is the
// backstop for duplicate names, unknown columns, fk arity mismatches, >1 pk,
// blank check expressions — surfaced via ui.editError on Save, and via the
// live per-tab error count in table-modal.tsx. `cardError` below is NOT a
// second copy of that engine — it's a narrower, presentation-only mirror of
// the subset of those same rules that are visible from THIS entity's own
// draft alone (no sibling-table lookups), so the mistake can be pointed at
// directly (a red border on the offending input, an 11px mono message inside
// THIS card) instead of only a generic banner at the top of the modal. The
// engine's own check remains the sole thing that actually blocks Save.
//
// A pk/unique/fk constraint's `name` input shows the name Postgres/drizzle
// would assign if left blank — greyed, via `placeholder` (see
// generated-constraint-name.ts for exactly which mechanism decides each
// kind's name, matching what export-drizzle.ts actually emits) — never
// written to the model: a blank name stays blank (`e.target.value || null`),
// same as before. A CHECK constraint has NO such auto-name (drizzle's check()
// requires one — export-drizzle's emitCheck throws on a blank one), so its
// card never shows that greyed preview (a placeholder implying "safe to
// leave blank" would be a lie there) — instead a blank CHECK name is a real,
// required-field mistake, surfaced the same way as every other in-card error
// below (Task 12 review, Finding 2).
//
// Composite fk columns/refColumns march in ColumnMultiSelect's own tick
// order (surfaced now as numbered chips), and a target-table change always
// resets refColumns so a stale column from the PREVIOUS target can't survive.

import type { Constraint, Model } from '../../engine/model/types';
import { cn } from '../../ui/cn';
import { ColumnMultiSelect } from './column-multi-select';
import { FkActionSelect } from './fk-action-select';
import { generatedConstraintName } from './generated-constraint-name';

const card = cn('flex flex-col gap-2 rounded-xl border border-gray-600 bg-gray-900 p-3');
const input = cn('rounded border border-gray-600 bg-gray-900 px-2 py-1', 'text-xs text-gray-50');
const inputInvalid = cn('rounded border border-red-600 bg-red-950 px-2 py-1', 'text-xs text-red-200');
const selectCls = cn(input, 'shrink-0');
const addBtn = 'rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800';
const badgeBase = cn('rounded px-2 py-1 font-mono text-3xs font-semibold', 'uppercase tracking-widest');
const badgeNeutral = cn(badgeBase, 'bg-gray-800 text-gray-300');
const badgeFk = cn(badgeBase, 'bg-blue-900 text-blue-300');
const iconBtn = cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', 'text-gray-400 hover:bg-gray-800 hover:text-gray-50');
const errMsg = cn('rounded border border-red-600 bg-red-950 px-2 py-1', 'font-mono text-xs text-red-400');

const KIND_LABEL: Record<Constraint['kind'], string> = { pk: 'primary key', unique: 'unique', check: 'check', fk: 'foreign key' };

function nextId(constraints: Constraint[]): string {
  const max = constraints.reduce((m, c) => Math.max(m, Number(c.id.replace(/^c/, '')) || 0), 0);
  return `c${max + 1}`;
}

function blank(kind: Constraint['kind'], id: string): Constraint {
  switch (kind) {
    case 'pk':
      return { id, kind: 'pk', name: null, columns: [] };
    case 'unique':
      return { id, kind: 'unique', name: null, columns: [], nullsNotDistinct: false };
    case 'check':
      return { id, kind: 'check', name: null, expression: '' };
    case 'fk':
      return { id, kind: 'fk', name: null, columns: [], refSchema: null, refTable: '', refColumns: [], onDelete: null, onUpdate: null };
  }
}

// A narrow, presentation-only mirror of apply-model-edit's validateConstraints
// — see the module header. Only ever reads THIS entity's own draft
// (constraints + its own column list), never another table, so it can run
// live on every keystroke with no model lookups.
function cardError(c: Constraint, all: Constraint[], ownColumns: string[]): string | null {
  if (c.name && all.some((o) => o.id !== c.id && o.name === c.name)) return `Duplicate constraint name "${c.name}".`;

  if (c.kind === 'check') {
    if (!c.expression.trim()) return 'Check constraint must have a non-blank expression.';
    // Unlike pk/unique/fk, drizzle's check() has no auto-generated name (its
    // `name` arg is mandatory — see export-drizzle.ts's emitCheck) — so a
    // blank name here is a real mistake, not something safe to leave for
    // Postgres/drizzle to fill in.
    if (!c.name || !c.name.trim()) return 'Check constraint must have a name.';
    return null;
  }

  if (c.columns.length === 0) return 'Must reference at least one column.';
  for (const col of c.columns) if (!ownColumns.includes(col)) return `Unknown column "${col}".`;

  if (c.kind === 'pk' && all.filter((o) => o.kind === 'pk').length > 1) return 'Only one primary key constraint is allowed per table.';

  if (c.kind === 'fk' && c.refTable && c.columns.length !== c.refColumns.length) {
    return 'Foreign key must reference the same number of columns as it defines.';
  }

  return null;
}

interface ConstraintsEditorProps {
  model: Model;
  ownId: string;
  columns: string[];
  constraints: Constraint[];
  onChange: (next: Constraint[]) => void;
}

export function ConstraintsEditor({ model, ownId, columns, constraints, onChange }: ConstraintsEditorProps) {
  const add = (kind: Constraint['kind']) => onChange([...constraints, blank(kind, nextId(constraints))]);
  const patch = (i: number, next: Partial<Constraint>) =>
    onChange(constraints.map((c, j) => (j === i ? ({ ...c, ...next } as Constraint) : c)));
  const remove = (i: number) => onChange(constraints.filter((_, j) => j !== i));

  const targetColumns = (refTable: string): string[] =>
    refTable === ownId ? columns : (model.entityById.get(refTable)?.columns.map((c) => c.name) ?? []);

  // The entity this constraint belongs to, for generatedConstraintName's own
  // schema-stripping (see its header comment) — falls back to a bare
  // {id, schema: null} for a brand-new table not in the model yet (create
  // mode never has a schema to strip in the first place; see table-modal.tsx).
  const ownEntity = model.entityById.get(ownId) ?? { id: ownId, schema: null };

  return (
    <div className="flex flex-col gap-2">
      {constraints.map((c, i) => {
        const n = i + 1;
        const err = cardError(c, constraints, columns);
        // Only ever true for an fk with a target already chosen — the one
        // shape where the CHIPS themselves (not just the name) are the
        // mistake (frame 1e).
        const arityMismatch = c.kind === 'fk' && err != null && err.startsWith('Foreign key must reference');
        const nameErr = err != null && (err.startsWith('Duplicate constraint name') || err.startsWith('Check constraint must have a name'));
        // A CHECK has no auto-name at all (see the module header) — never
        // compute/show the "informational only" preview generatedConstraintName
        // still returns for a check (that value exists purely for that
        // function's own tests); the plain "name" fallback below plus the red
        // border above is what actually flags a blank one as a mistake.
        const preview = c.kind === 'check' ? null : generatedConstraintName(ownEntity, c, constraints);

        return (
          <div key={c.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={c.kind === 'fk' ? badgeFk : badgeNeutral}>{KIND_LABEL[c.kind]}</span>
              <input
                className={cn(nameErr ? inputInvalid : input, 'w-28')}
                placeholder={preview ?? 'name'}
                aria-label={`Constraint ${n} name`}
                value={c.name ?? ''}
                onChange={(e) => patch(i, { name: e.target.value || null })}
              />
              {c.kind === 'fk' && <span className="ml-auto text-3xs text-blue-300">draws an edge on the canvas</span>}
              <button type="button" className={iconBtn} aria-label={`Remove constraint ${n}`} onClick={() => remove(i)}>
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(c.kind === 'pk' || c.kind === 'unique') && (
                <ColumnMultiSelect options={columns} value={c.columns} onChange={(v) => patch(i, { columns: v })} label={`Constraint ${n} column`} />
              )}

              {c.kind === 'unique' && (
                <label className="flex items-center gap-1 text-2xs text-gray-400">
                  <input
                    type="checkbox"
                    aria-label={`Constraint ${n} nulls not distinct`}
                    checked={c.nullsNotDistinct}
                    onChange={(e) => patch(i, { nullsNotDistinct: e.target.checked })}
                  />
                  nulls not distinct
                </label>
              )}

              {c.kind === 'check' && (
                <input
                  className={cn(err ? inputInvalid : input, 'grow')}
                  aria-label={`Constraint ${n} expression`}
                  value={c.expression}
                  onChange={(e) => patch(i, { expression: e.target.value })}
                />
              )}

              {c.kind === 'fk' && (
                <>
                  <ColumnMultiSelect
                    options={columns}
                    value={c.columns}
                    onChange={(v) => patch(i, { columns: v })}
                    label={`Constraint ${n} column`}
                    invalid={arityMismatch}
                  />
                  <span className="text-gray-400" aria-hidden>
                    →
                  </span>
                  <select
                    className={selectCls}
                    aria-label={`Constraint ${n} target table`}
                    value={c.refTable}
                    onChange={(e) => patch(i, { refTable: e.target.value, refColumns: [] })}
                  >
                    <option value="">– choose table –</option>
                    {model.entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                  {c.refTable && (
                    <ColumnMultiSelect
                      options={targetColumns(c.refTable)}
                      value={c.refColumns}
                      onChange={(v) => patch(i, { refColumns: v })}
                      label={`Constraint ${n} target column`}
                      invalid={arityMismatch}
                    />
                  )}
                  <FkActionSelect label={`Constraint ${n} on delete`} value={c.onDelete} onChange={(v) => patch(i, { onDelete: v })} />
                  <FkActionSelect label={`Constraint ${n} on update`} value={c.onUpdate} onChange={(v) => patch(i, { onUpdate: v })} />
                </>
              )}
            </div>

            {err && <p className={errMsg}>{err}</p>}
          </div>
        );
      })}

      <div className="flex gap-2">
        <button type="button" className={addBtn} onClick={() => add('pk')}>
          + primary key
        </button>
        <button type="button" className={addBtn} onClick={() => add('unique')}>
          + unique
        </button>
        <button type="button" className={addBtn} onClick={() => add('fk')}>
          + foreign key
        </button>
        <button type="button" className={addBtn} onClick={() => add('check')}>
          + check
        </button>
      </div>
    </div>
  );
}
