// The constraints editor — the ONLY place a user creates a PRIMARY KEY,
// UNIQUE, CHECK, or FOREIGN KEY constraint. A FOREIGN KEY is now the only way
// to draw an edge between two tables (see derive-relationships.ts): the row
// below is bookkeeping around it, not the edge itself.
//
// Engine-side validation (apply-model-edit's validateConstraints) is the
// backstop for duplicate names, unknown columns, fk arity mismatches, >1 pk,
// blank check expressions — surfaced via ui.editError on Save. This editor
// does not re-implement those rules; it just keeps invalid shapes hard to
// reach (composite fk columns/refColumns march in ColumnMultiSelect's own
// tick order, and a target-table change always resets refColumns so a stale
// column from the PREVIOUS target can't survive).

import type { Constraint, Model } from '../../engine/model/types';
import { cn } from '../../ui/cn';
import { ColumnMultiSelect } from './column-multi-select';
import { FkActionSelect } from './fk-action-select';

const input = cn('rounded border border-gray-600 bg-gray-900 px-2 py-1', 'text-xs text-gray-50');
const selectCls = cn(input, 'shrink-0');
const addBtn = 'rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800';
const kindBadge = cn('rounded bg-gray-800 px-2 py-1 font-mono text-3xs font-semibold', 'uppercase tracking-widest text-gray-300');
const iconBtn = cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', 'text-gray-400 hover:bg-gray-800 hover:text-gray-50');

function nextId(constraints: Constraint[]): string {
  const max = constraints.reduce((m, c) => Math.max(m, Number(c.id.replace(/^c/, '')) || 0), 0);
  return `c${max + 1}`;
}

function blank(kind: Constraint['kind'], id: string): Constraint {
  switch (kind) {
    case 'pk':
      return { id, kind: 'pk', name: null, columns: [] };
    case 'unique':
      return { id, kind: 'unique', name: null, columns: [] };
    case 'check':
      return { id, kind: 'check', name: null, expression: '' };
    case 'fk':
      return { id, kind: 'fk', name: null, columns: [], refTable: '', refColumns: [], onDelete: null, onUpdate: null };
  }
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

  return (
    <div className="flex flex-col gap-2">
      {constraints.map((c, i) => {
        const n = i + 1;
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-600 p-2">
            <span className={kindBadge}>{c.kind}</span>
            <input
              className={cn(input, 'w-28')}
              placeholder="name"
              aria-label={`Constraint ${n} name`}
              value={c.name ?? ''}
              onChange={(e) => patch(i, { name: e.target.value || null })}
            />

            {(c.kind === 'pk' || c.kind === 'unique') && (
              <ColumnMultiSelect options={columns} value={c.columns} onChange={(v) => patch(i, { columns: v })} label={`Constraint ${n} column`} />
            )}

            {c.kind === 'check' && (
              <input
                className={cn(input, 'grow')}
                aria-label={`Constraint ${n} expression`}
                value={c.expression}
                onChange={(e) => patch(i, { expression: e.target.value })}
              />
            )}

            {c.kind === 'fk' && (
              <>
                <ColumnMultiSelect options={columns} value={c.columns} onChange={(v) => patch(i, { columns: v })} label={`Constraint ${n} column`} />
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
                  />
                )}
                <FkActionSelect label={`Constraint ${n} on delete`} value={c.onDelete} onChange={(v) => patch(i, { onDelete: v })} />
                <FkActionSelect label={`Constraint ${n} on update`} value={c.onUpdate} onChange={(v) => patch(i, { onUpdate: v })} />
              </>
            )}

            <button type="button" className={cn(iconBtn, 'ml-auto')} aria-label={`Remove constraint ${n}`} onClick={() => remove(i)}>
              ✕
            </button>
          </div>
        );
      })}

      <div className="flex gap-2">
        <button type="button" className={addBtn} onClick={() => add('pk')}>
          + PK
        </button>
        <button type="button" className={addBtn} onClick={() => add('unique')}>
          + UNIQUE
        </button>
        <button type="button" className={addBtn} onClick={() => add('fk')}>
          + FK
        </button>
        <button type="button" className={addBtn} onClick={() => add('check')}>
          + CHECK
        </button>
      </div>
    </div>
  );
}
