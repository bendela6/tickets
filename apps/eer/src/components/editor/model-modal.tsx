// Edit the current model's title/description, or delete it outright.
// Delete-model fallback (documented in the task report): reload the model
// list and switch to the first remaining model; if none remain — or the
// fallback model fails to load — clear ui.modelId (CLEAR_MODEL_ID) so a
// leftover Save click can't resurrect the file just deleted, and keep the
// current (now-orphaned) model on screen with an inline notice rather than
// clearing the diagram out from under the user.
//
// NewModelModal lives in ./new-model-modal.tsx (split out to keep both files
// near the ~120-line guideline) — see that file for seededRaw() too.

import { useState } from 'react';

import { deleteModel, getModel, listModels } from '../../api/models-client';
import { applyModelEdit as tryApplyModelEdit } from '../../engine/model/apply-model-edit';
import { loadModel } from '../../engine/model/load-model';
import type { Model } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { cn } from '@tickets/ui';
import { Modal } from '../modal';
import { EnumsEditor } from './enums-editor';

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
      // getModel throws on a network failure or a non-ok response (unlike
      // deleteModel/listModels, which degrade to false/null) — uncaught here,
      // that throw would escape as an unhandled rejection (handleDelete is
      // fire-and-forgot via `void`) and leave `busy` stuck forever. Treat it
      // the same as "failed to load" below: don't strand ui.modelId, stay open.
      try {
        const raw = await getModel(next.id);
        const result = loadModel(raw);
        // Same validity check as ModelMenu's selectModel(): a model with errors
        // is still a (possibly empty/garbage) object here, never null — errors
        // must be checked explicitly, not just truthiness of result.model.
        if (!result.errors.length && result.model) {
          actions.load(result.model, next.id);
          setBusy(false);
          onClose();
          return;
        }
      } catch {
        // fall through to the shared "failed to load" handling below.
      }
      // A fallback model exists but failed to load (or threw) — do NOT close
      // (that would silently strand the deleted id in ui.modelId, letting a
      // later Save resurrect the file). Clear the id instead and stay open
      // with a notice.
      actions.clearModelId();
      setBusy(false);
      setNotice('Model deleted, but the next model failed to load — pick another from the menu.');
      return;
    }
    // No models remain — same resurrection risk if ui.modelId were left set.
    actions.clearModelId();
    setBusy(false);
    setNotice('Model deleted. No other models remain — create a new one to continue.');
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

      <div className={label}>
        Enums
        <EnumsEditor model={model} onApplyEdit={actions.applyModelEdit} />
      </div>

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
