// Edit the current model's title/description, or delete it outright — and,
// since both share the tiny seededRaw() bootstrap fixture, the New-model form
// too. Delete-model fallback (documented in the task report): reload the
// model list and switch to the first remaining model; if none remain, leave
// the current (now-orphaned) model on screen and show an inline notice rather
// than clearing the diagram out from under the user.

import { useState } from 'react';

import { createModel, deleteModel, getModel, listModels } from '../../api/models-client';
import { applyModelEdit as tryApplyModelEdit } from '../../engine/model/apply-model-edit';
import { loadModel } from '../../engine/model/load-model';
import type { Model } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { cn } from '../../ui/cn';
import { Modal } from '../modal';

export function seededRaw(title: string): Record<string, unknown> {
  return {
    meta: { title, description: '' },
    view: { routing: 'avoid' },
    kinds: [{ id: 'fk', label: 'FK constraint' }],
    groups: [{ id: 'main', label: 'Main', order: 0 }],
    entities: [{ id: 'table_1', label: 'table_1', group: 'main', fields: [{ name: 'id', type: 'serial', role: 'pk' }] }],
  };
}

const field = cn('w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1', 'text-sm text-gray-50');
const label = 'flex flex-col gap-1 text-xs text-gray-400';
const errorRow = cn('flex items-start justify-between gap-2 rounded-md border border-red-600', 'bg-red-950 px-2 py-1 text-sm text-red-400');

// <EditorModals/> only opens this once a model is loaded; bail defensively
// (same rationale as GroupModal) rather than let useState below run unevenly.
export function ModelModal({ onClose }: { onClose: () => void }) {
  const model = useDiagramModelOrNull();
  if (!model) return null;
  return <ModelModalForm model={model} onClose={onClose} />;
}

function ModelModalForm({ model, onClose }: { model: Model; onClose: () => void }) {
  const ui = useDiagramUi();
  const actions = useDiagramActions();
  const [title, setTitle] = useState(model.meta.title ?? '');
  const [description, setDescription] = useState(model.meta.description ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    const edit = { kind: 'setMeta' as const, title, description };
    actions.applyModelEdit(edit);
    try {
      // Same synchronous re-check as GroupModal's save() — see its comment.
      tryApplyModelEdit(model, edit);
      onClose();
    } catch {
      // ui.editError renders below on the next render; stay open.
    }
  };

  const handleDelete = async () => {
    if (!ui.modelId) return;
    setBusy(true);
    const ok = await deleteModel(ui.modelId);
    if (!ok) {
      setBusy(false);
      setNotice('Delete failed — the server rejected the request.');
      return;
    }
    const list = await listModels();
    const next = list && list.length > 0 ? list[0] : null;
    if (next) {
      const raw = await getModel(next.id);
      const result = loadModel(raw);
      if (result.model) actions.load(result.model, next.id);
    }
    setBusy(false);
    if (next) onClose();
    else setNotice('Model deleted. No other models remain — create a new one to continue.');
  };

  return (
    <Modal title="Edit model" onClose={onClose}>
      {ui.editError && (
        <div className={errorRow}>
          <span>{ui.editError}</span>
          <button type="button" className="shrink-0" onClick={actions.clearEditError} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <label className={label}>
        Title
        <input className={field} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className={label}>
        Description
        <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          className="rounded-md border border-red-700 px-3 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
          disabled={!ui.modelId || busy}
          onClick={() => void handleDelete()}
        >
          Delete model
        </button>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-2 text-sm text-gray-50 hover:bg-blue-500" onClick={save}>
          Save
        </button>
      </div>
      {notice && <p className="text-xs text-yellow-400">{notice}</p>}
    </Modal>
  );
}

export function NewModelModal({ onClose }: { onClose: () => void }) {
  const actions = useDiagramActions();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    const result = await createModel(seededRaw(trimmed));
    setCreating(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const { model } = loadModel(seededRaw(trimmed));
    if (model) actions.load(model, result.id);
    onClose();
  };

  return (
    <Modal title="New model" onClose={onClose}>
      {error && (
        <div className={errorRow}>
          <span>{error}</span>
          <button type="button" className="shrink-0" onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <label className={label}>
        Title
        <input
          className={field}
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create();
          }}
        />
      </label>
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm text-gray-50 hover:bg-blue-500 disabled:opacity-50"
          disabled={!title.trim() || creating}
          onClick={() => void create()}
        >
          Create
        </button>
      </div>
    </Modal>
  );
}
