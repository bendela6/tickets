// Create/edit a zone or subgroup. Colour is shown only in edit mode: it writes
// straight through actions.setColors (the same override map ColorsForm uses),
// live on every change — a brand-new group has nothing to override yet, so a
// create-mode swatch would key a colour to an id that might never be saved.

import { useState } from 'react';

import { groupColor } from '../../engine/colors/group-color';
import { applyModelEdit as tryApplyModelEdit } from '../../engine/model/apply-model-edit';
import type { Model } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { cn } from '../../ui/cn';
import { Modal } from '../modal';

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

// <EditorModals/> only opens this modal once a model is loaded, but the very
// first render of a test harness (or a boundary re-load race in the real app)
// can catch model still null — bail rather than crash. The hooks that need a
// real Model (and must run unconditionally) live in GroupModalForm below.
export function GroupModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const model = useDiagramModelOrNull();
  if (!model) return null;
  return <GroupModalForm model={model} id={id} onClose={onClose} />;
}

function GroupModalForm({ model, id, onClose }: { model: Model; id?: string; onClose: () => void }) {
  const ui = useDiagramUi();
  const actions = useDiagramActions();
  const existing = id ? model.groups.find((g) => g.id === id) : undefined;
  const isEdit = existing != null;

  const [name, setName] = useState(existing?.label ?? '');
  const [isSub, setIsSub] = useState(existing ? existing.parent != null : false);
  const topZones = model.groups.filter((g) => !g.parent && g.id !== id);
  const [parent, setParent] = useState<string | null>(existing?.parent ?? topZones[0]?.id ?? null);

  const groupId = isEdit ? existing!.id : slugify(name);
  const memberCount = id ? model.entities.filter((e) => e.group === id).length : 0;
  const subCount = id ? model.groups.filter((g) => g.parent === id).length : 0;
  const blockReason = [memberCount > 0 ? `${memberCount} table(s)` : null, subCount > 0 ? `${subCount} subgroup(s)` : null]
    .filter(Boolean)
    .join(' and ');

  const save = () => {
    const edit = {
      kind: 'upsertGroup' as const,
      group: { id: groupId, label: name.trim(), parent: isSub ? parent : null },
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
    if (!id || blockReason) return;
    actions.applyModelEdit({ kind: 'deleteGroup', id });
    onClose();
  };

  return (
    <Modal title={isEdit ? `Edit ${existing!.label}` : 'New group'} onClose={onClose}>
      {ui.editError && (
        <div className={errorRow}>
          <span>{ui.editError}</span>
          <button type="button" className="shrink-0" onClick={actions.clearEditError} aria-label="Dismiss error">
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
        <input className={cn(field, 'text-gray-400')} value={groupId} disabled readOnly />
      </label>

      <fieldset className={label}>
        <legend className="mb-1">Kind</legend>
        <label className="flex items-center gap-2 text-sm text-gray-50">
          <input type="radio" name="kind" checked={!isSub} onChange={() => setIsSub(false)} />
          Zone
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-50">
          <input type="radio" name="kind" checked={isSub} disabled={topZones.length === 0} onChange={() => setIsSub(true)} />
          Subgroup
        </label>
        {isSub && (
          <select
            aria-label="Parent zone"
            className={cn(field, 'mt-1')}
            value={parent ?? ''}
            onChange={(e) => setParent(e.target.value)}
          >
            {topZones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      {id && <ColorRow model={model} id={id} colors={ui.colors} onChange={actions.setColors} />}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          className="rounded-md border border-red-700 px-3 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
          disabled={!id || !!blockReason}
          title={blockReason ? `Contains ${blockReason}` : undefined}
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

interface ColorRowProps {
  model: Model;
  id: string;
  colors: ReadonlyMap<string, string>;
  onChange: (next: ReadonlyMap<string, string>) => void;
}

function ColorRow({ model, id, colors, onChange }: ColorRowProps) {
  const overridden = colors.has(id);
  const effective = groupColor(model, id, colors);
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
