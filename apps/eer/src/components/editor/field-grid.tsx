// The table modal's field editor. Pure controlled grid: `table-modal.tsx` owns
// the draft array and all validation; this component only renders rows and
// reports whole-array patches back up via onChange. Connections are DERIVED
// from fk fields (see apply-model-edit's header comment) — there is no
// separate connection editor, so toggling a row to FK + picking a ref/field
// IS how an edge gets created, and clearing either removes it. The hint line
// below the grid is the only place that's spelled out for the user.

import type { Model, Role } from '../../engine/model/types';
import type { EditField } from '../../engine/model/apply-model-edit';
import { cn } from '../../ui/cn';

const cellInput = cn('w-full rounded border border-gray-600 bg-gray-900 px-1 py-1', 'font-mono text-xs text-gray-50');
const cellSelect = cn(cellInput, 'disabled:cursor-default disabled:opacity-40');
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
  role: 'w-16 shrink-0',
  ref: 'w-32 grow',
  refField: 'w-32 grow',
  note: 'w-40 grow',
} as const;

interface FieldGridProps {
  model: Model;
  ownId: string;
  fields: EditField[];
  onChange: (fields: EditField[]) => void;
}

// A field's ref target's fields, for the ref-field select's options. `ownId`
// covers a table referencing itself (e.g. a fresh row's manager_id -> its own
// not-yet-saved id) the same way apply-model-edit's own validation does: the
// in-progress draft stands in for the (not yet upserted) entity's field list.
function targetFieldNames(model: Model, ownId: string, ownFields: EditField[], ref: string | null): string[] {
  if (!ref) return [];
  const fields = ref === ownId ? ownFields : model.entityById.get(ref)?.fields;
  return fields ? fields.map((f) => f.name) : [];
}

export function FieldGrid({ model, ownId, fields, onChange }: FieldGridProps) {
  const patch = (index: number, next: Partial<EditField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...next } : f)));
  };

  const setRole = (index: number, role: Role) => {
    patch(index, role === 'fk' ? { role } : { role, ref: null, refField: null });
  };

  const setRef = (index: number, ref: string) => {
    patch(index, { ref: ref || null, refField: null });
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
    onChange([
      ...fields,
      { name: '', type: 'text', role: null, ref: null, refField: null, title: null, description: null, nullable: true, default: null },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-gray-600">
        <div>
          <div className="flex items-center gap-2 border-b border-gray-600 bg-gray-900 px-2 py-1">
            <span className={cn(colHead, COL.name)}>Name</span>
            <span className={cn(colHead, COL.type)}>Type</span>
            <span className={cn(colHead, COL.role)}>Role</span>
            <span className={cn(colHead, COL.ref)}>Ref table</span>
            <span className={cn(colHead, COL.refField)}>Ref field</span>
            <span className={cn(colHead, COL.note)}>Note</span>
            <span className="w-20 shrink-0" aria-hidden />
          </div>
          {fields.map((f, i) => {
            const isFk = f.role === 'fk';
            const refFieldNames = targetFieldNames(model, ownId, fields, f.ref);
            return (
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
                <select
                  className={cn(cellSelect, COL.role)}
                  aria-label={`Field ${i + 1} role`}
                  value={f.role ?? ''}
                  onChange={(e) => setRole(i, (e.target.value || null) as Role)}
                >
                  <option value="">–</option>
                  <option value="pk">PK</option>
                  <option value="fk">FK</option>
                </select>
                <select
                  className={cn(cellSelect, COL.ref)}
                  aria-label={`Field ${i + 1} reference table`}
                  value={f.ref ?? ''}
                  disabled={!isFk}
                  onChange={(e) => setRef(i, e.target.value)}
                >
                  <option value="">–</option>
                  {model.entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <select
                  className={cn(cellSelect, COL.refField)}
                  aria-label={`Field ${i + 1} reference field`}
                  value={f.refField ?? ''}
                  disabled={!isFk || !f.ref}
                  onChange={(e) => patch(i, { refField: e.target.value || null })}
                >
                  <option value="">–</option>
                  {refFieldNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
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
            );
          })}
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
        <p className="text-2xs text-gray-400">FK role + a reference is what draws a connection — there's no separate edge editor.</p>
      </div>
    </div>
  );
}
