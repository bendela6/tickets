// Create/edit a table (entity) — name, group, description, a colour override
// (edit mode only, same reasoning as GroupModal: a brand-new entity's id might
// never be saved, so there's nothing yet to key a colour override to), the
// field grid, and a guarded delete. Fields are a local EditField[] draft;
// Save pre-validates then dispatches ONE upsertEntity for the whole entity —
// applyModelEdit's own validation is the backstop (duplicate names, dangling
// fk refs, …), surfaced via ui.editError if this component's own checks miss
// something the engine still rejects.

import { useState } from 'react';

import { entityColor } from '../../engine/colors/entity-color';
import { applyModelEdit as tryApplyModelEdit, fkRefsTo, type EditField } from '../../engine/model/apply-model-edit';
import type { Entity, Field, Model } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { cn } from '../../ui/cn';
import { Modal } from '../modal';
import { FieldGrid } from './field-grid';

const field = cn('w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1', 'text-sm text-gray-50');
const label = 'flex flex-col gap-1 text-xs text-gray-400';
const errorRow = cn('flex items-start justify-between gap-2 rounded-md border border-red-600', 'bg-red-950 px-2 py-1 text-sm text-red-400');

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// `title` has no editable column in FieldGrid (the grid's "note" column is
// `description`) — it's carried through untouched so a no-op Save can't
// destroy it (see apply-model-edit's EditField and upsertEntity).
function toEditField(f: Field): EditField {
  return { name: f.name, type: f.type, role: f.role, ref: f.ref, refField: f.refField, title: f.title, description: f.description ?? '' };
}

const DEFAULT_PK: EditField = { name: 'id', type: 'serial', role: 'pk', ref: null, refField: null, title: null, description: null };

// A field with an fk role but no ref is caught here with a nicer message than
// the engine's — engine validation is still the backstop for anything this
// misses. refField is deliberately NOT required: a null refField defaults to
// "id" (apply-model-edit's own validateEditFields does `f.refField ?? 'id'`),
// and real seed data relies on that default — requiring it here would block
// Save on perfectly valid, already-loaded fk fields.
function validateDraft(fields: EditField[]): string | null {
  const seen = new Set<string>();
  for (const f of fields) {
    const name = f.name.trim();
    if (!name) return 'Every field needs a name.';
    if (seen.has(name)) return `Duplicate field name "${name}".`;
    seen.add(name);
    if (f.role === 'fk' && !f.ref) return `Field "${name || '(unnamed)'}" needs a reference table.`;
  }
  return null;
}

// Zones first, each followed by its subgroups (indented) — entities can live
// directly in a zone or in one of its subgroups.
function groupOptions(model: Model): { id: string; label: string }[] {
  const zones = model.groups.filter((g) => !g.parent);
  return zones.flatMap((z) => [
    { id: z.id, label: z.label },
    ...model.groups.filter((g) => g.parent === z.id).map((sg) => ({ id: sg.id, label: `— ${sg.label}` })),
  ]);
}

// <EditorModals/> only opens this modal once a model is loaded, but bail
// rather than crash on the very first render of a bare test harness (or a
// boundary re-load race in the real app) — same rationale as GroupModal.
export function TableModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const model = useDiagramModelOrNull();
  if (!model) return null;
  return <TableModalForm model={model} id={id} onClose={onClose} />;
}

function TableModalForm({ model, id, onClose }: { model: Model; id?: string; onClose: () => void }) {
  const ui = useDiagramUi();
  const actions = useDiagramActions();
  const existing: Entity | undefined = id ? model.entityById.get(id) : undefined;
  const isEdit = existing != null;

  const options = groupOptions(model);
  const defaultGroup = options[0]?.id ?? '';

  const [name, setName] = useState(existing?.label ?? '');
  const [group, setGroup] = useState(existing?.group ?? defaultGroup);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [fields, setFields] = useState<EditField[]>(existing ? existing.fields.map(toEditField) : [DEFAULT_PK]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const entityId = isEdit ? existing!.id : slugify(name);

  const save = () => {
    // upsertEntity is an upsert by design (editing relies on it), so in CREATE
    // mode only, a slugified name that collides with an existing table's id
    // would silently overwrite it instead of erroring — block it here before
    // it ever reaches the engine.
    if (!isEdit && model.entityById.has(entityId)) {
      setLocalError(`A table with id "${entityId}" already exists.`);
      return;
    }
    const err = validateDraft(fields);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);

    const edit = {
      kind: 'upsertEntity' as const,
      entity: {
        id: entityId,
        label: name.trim(),
        group,
        description: description.trim() ? description.trim() : null,
        fields: fields.map((f) => ({
          name: f.name.trim(),
          type: f.type.trim(),
          role: f.role,
          // NOT stripped by role here — a role:'pk' (or null) field can
          // legitimately carry a `ref` (e.g. the seed's outbox.event_id: a
          // shared-pk identifying reference). FieldGrid's setRole already
          // clears ref/refField the moment a USER actively moves a row's role
          // away from 'fk' — that's the only place this should ever happen.
          ref: f.ref,
          refField: f.refField,
          title: f.title,
          description: f.description && f.description.trim() ? f.description.trim() : null,
        })),
      },
    };
    actions.applyModelEdit(edit);
    try {
      // The reducer runs the identical pure edit but only reflects the outcome
      // on the NEXT render (dispatch is async) — re-run it here, synchronously,
      // against the same pre-dispatch model, to decide whether to close now.
      tryApplyModelEdit(model, edit);
      onClose();
    } catch {
      // Invalid: ui.editError renders below on the next render; stay open.
    }
  };

  const remove = () => {
    if (!id) return;
    actions.applyModelEdit({ kind: 'deleteEntity', id });
    actions.clearSelection();
    onClose();
  };

  const refs = id ? fkRefsTo(model, id) : [];

  return (
    <Modal title={isEdit ? `Edit ${existing!.label}` : 'New table'} onClose={onClose} size="wide">
      {(localError || ui.editError) && (
        <div className={errorRow}>
          <span>{localError ?? ui.editError}</span>
          <button
            type="button"
            className="shrink-0"
            onClick={() => (localError ? setLocalError(null) : actions.clearEditError())}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <label className={label}>
        Name
        <input className={field} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      </label>

      <label className={label}>
        Id
        <input className={cn(field, 'text-gray-400')} value={entityId} disabled readOnly />
      </label>

      <label className={label}>
        Group
        <select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        Description
        <textarea className={field} rows={2} value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
      </label>

      {isEdit && <ColorRow model={model} id={existing!.id} colors={ui.colors} onChange={actions.setColors} />}

      <div className={label}>
        <span>Fields</span>
        <FieldGrid model={model} ownId={entityId} fields={fields} onChange={setFields} />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {confirmingDelete && (
          <div className={cn('flex flex-col gap-2 rounded-md border border-red-700', 'bg-red-950 px-2 py-2 text-xs text-red-400')}>
            <span>
              {refs.length > 0
                ? `Deleting clears ${refs.length} reference field(s): ${refs.map((r) => `${r.entityId}.${r.field}`).join(', ')}.`
                : 'This cannot be undone.'}
            </span>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded px-2 py-1 text-gray-200 hover:bg-gray-800" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <button type="button" className="rounded bg-red-700 px-2 py-1 text-gray-50 hover:bg-red-600" onClick={remove}>
                Confirm delete
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-md border border-red-700 px-3 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
            disabled={!isEdit}
            onClick={() => setConfirmingDelete(true)}
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
      </div>
    </Modal>
  );
}

interface ColorRowProps {
  model: Model;
  id: string;
  colors: ReadonlyMap<string, string>;
  onChange: (next: ReadonlyMap<string, string>) => void;
}

function ColorRow({ model, id, colors, onChange }: ColorRowProps) {
  const overridden = colors.has(id);
  const effective = entityColor(model, id, colors);
  const patch = (value: string | null) => {
    const next = new Map(colors);
    if (value === null) next.delete(id);
    else next.set(id, value);
    onChange(next);
  };
  return (
    <label className="flex items-center gap-2 text-xs text-gray-400">
      <input type="checkbox" checked={overridden} onChange={(e) => patch(e.target.checked ? effective : null)} />
      Override colour
      <input type="color" value={effective} disabled={!overridden} onChange={(e) => patch(e.target.value)} aria-label="Colour" />
    </label>
  );
}
