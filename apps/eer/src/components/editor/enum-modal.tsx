// Create/edit ONE enum (name + ordered values + optional schema), the enum
// counterpart to TableModal/GroupModal — reached from the "+ Add" chooser and
// batched on Save (unlike the always-open list manager in EnumsEditor, which
// dispatches per keystroke-group). An enum's declaration lives at the model
// level and is shared by every column that names it, so Save dispatches a
// renameEnum (when the name changed — which rewrites every column typed to the
// old name) followed by an upsertEnum carrying the current values + schema.
//
// Delete is refused while any column still uses the enum (same guard the engine's
// deleteEnum enforces and EnumsEditor surfaces): rather than dispatch a doomed
// edit, enumRefsTo is checked up front and the blocking columns are named.

import { useState } from 'react';

import { applyModelEdit as tryApplyModelEdit, enumRefsTo, type ModelEdit } from '../../engine/model/apply-model-edit';
import type { Model } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull } from '../../state/diagram-context';
import { cn } from '@tickets/ui';
import { Modal } from '../modal';

const field = cn('w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1', 'text-sm text-gray-50');
const label = 'flex flex-col gap-1 text-xs text-gray-400';
const errorRow = cn('flex items-start justify-between gap-2 rounded-md border border-red-600', 'bg-red-950 px-2 py-1 text-sm text-red-400');
const chip = cn('flex items-center gap-1 rounded border border-gray-600 bg-gray-900 px-1 py-1');
const chipNum = 'font-mono text-3xs text-gray-500';
const iconBtn = cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', 'text-gray-400 hover:bg-gray-800 hover:text-gray-50');
const iconBtnDisabled = cn(iconBtn, 'disabled:pointer-events-none disabled:opacity-30');
const valueAdder = cn('w-24 rounded border border-dashed border-gray-600 bg-gray-900', 'px-2 py-1 text-sm text-gray-50');

// <EditorModals/> only opens this once a model is loaded, but bail rather than
// crash on the very first render of a bare test harness — same rationale as
// GroupModal/TableModal. The hooks that need a real Model live in the form below.
export function EnumModal({ name, onClose }: { name?: string; onClose: () => void }) {
  const model = useDiagramModelOrNull();
  if (!model) return null;
  return <EnumModalForm model={model} name={name} onClose={onClose} />;
}

function EnumModalForm({ model, name: initialName, onClose }: { model: Model; name?: string; onClose: () => void }) {
  const actions = useDiagramActions();
  const existing = initialName != null ? model.enums.find((e) => e.name === initialName) : undefined;
  const isEdit = existing != null;

  const [name, setName] = useState(existing?.name ?? '');
  const [values, setValues] = useState<string[]>(existing?.values ?? []);
  const [schema, setSchema] = useState(existing?.schema ?? '');
  const [pendingValue, setPendingValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refs = isEdit ? enumRefsTo(model, existing!.name) : [];

  const addValue = () => {
    const v = pendingValue.trim();
    if (!v || values.includes(v)) {
      setPendingValue('');
      return;
    }
    setValues([...values, v]);
    setPendingValue('');
  };
  const removeValue = (i: number) => setValues(values.filter((_, j) => j !== i));
  const moveValue = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= values.length) return;
    const next = values.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    setValues(next);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('An enum needs a name.');
      return;
    }
    // upsertEnum is an upsert by name; renaming/creating onto another enum's
    // name would silently overwrite it — block it, same as the id guards in
    // TableModal/GroupModal.
    if (model.enums.some((e) => e.name === trimmed && e.name !== existing?.name)) {
      setError(`An enum named "${trimmed}" already exists.`);
      return;
    }
    if (values.length === 0) {
      setError('An enum needs at least one value.');
      return;
    }
    setError(null);

    const schemaVal = schema.trim() && schema.trim() !== 'public' ? schema.trim() : null;
    const edits: ModelEdit[] = [];
    // Rename FIRST (rewrites every column typed to the old name), then upsert
    // under the new name to land the current values + schema.
    if (isEdit && existing!.name !== trimmed) edits.push({ kind: 'renameEnum', from: existing!.name, to: trimmed });
    edits.push({ kind: 'upsertEnum', enum: { name: trimmed, values, schema: schemaVal } });

    for (const edit of edits) actions.applyModelEdit(edit);
    try {
      let m = model;
      for (const edit of edits) m = tryApplyModelEdit(m, edit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = () => {
    if (!isEdit || refs.length > 0) return;
    actions.applyModelEdit({ kind: 'deleteEnum', name: existing!.name });
    onClose();
  };

  return (
    <Modal title={isEdit ? `Edit ${existing!.name}` : 'New enum'} onClose={onClose}>
      {error && (
        <div className={errorRow}>
          <span>{error}</span>
          <button type="button" className="shrink-0" onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <label className={label}>
        Name
        <input className={field} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      </label>

      <label className={label}>
        Schema
        <input className={field} value={schema} placeholder="public" onChange={(e) => setSchema(e.target.value)} />
      </label>

      <div className={label}>
        Values
        <div className="flex flex-wrap items-center gap-2">
          {values.map((v, i) => (
            <div key={i} className={chip}>
              <span className={chipNum}>{i + 1}</span>
              <span className="text-sm text-gray-100">{v}</span>
              <button type="button" className={iconBtnDisabled} aria-label={`Move value ${i + 1} up`} disabled={i === 0} onClick={() => moveValue(i, -1)}>
                ↑
              </button>
              <button
                type="button"
                className={iconBtnDisabled}
                aria-label={`Move value ${i + 1} down`}
                disabled={i === values.length - 1}
                onClick={() => moveValue(i, 1)}
              >
                ↓
              </button>
              <button type="button" className={iconBtn} aria-label={`Remove value ${i + 1}`} onClick={() => removeValue(i)}>
                ×
              </button>
            </div>
          ))}
          <input
            className={valueAdder}
            placeholder="+ value"
            aria-label="Add value"
            value={pendingValue}
            onChange={(e) => setPendingValue(e.target.value)}
            onBlur={addValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addValue();
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          className="rounded-md border border-red-700 px-3 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
          disabled={!isEdit || refs.length > 0}
          title={refs.length > 0 ? `Used by ${refs.map((r) => `${r.entityId}.${r.column}`).join(', ')}` : undefined}
          onClick={remove}
        >
          Delete
        </button>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm text-gray-50 hover:bg-blue-500 disabled:opacity-50"
          disabled={!name.trim()}
          onClick={save}
        >
          {isEdit ? 'Save' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}
