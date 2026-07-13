// Top-bar model menu: lists saved models from the dev-only models API, loads
// the selected one, and saves the current model back. Hides entirely once
// listModels() resolves null — that's the production-build signal (see
// models-client) that the API doesn't exist at all.

import { useEffect, useState } from 'react';

import { getModel, listModels, saveModel, type ModelSummary } from '../../api/models-client';
import { loadModel } from '../../engine/model/load-model';
import { serializeModel } from '../../engine/model/serialize-model';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { cn } from '../../ui/cn';

const btn = cn(
  'rounded-md border border-gray-600 bg-gray-900 px-3 py-2',
  'text-sm font-medium whitespace-nowrap text-gray-200',
  'hover:border-gray-500 hover:bg-gray-800 hover:text-gray-50',
);

const selectClass = cn('rounded-md border border-gray-600 bg-gray-900 px-2 py-1', 'text-sm text-gray-50');

export function ModelMenu() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUi();
  const actions = useDiagramActions();
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listModels().then((list) => {
      if (!cancelled) setModels(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (models === null) return null;

  const selectModel = (id: string) => {
    void getModel(id)
      .then((raw) => {
        const result = loadModel(raw);
        if (!result.errors.length && result.model) actions.load(result.model, id);
        else console.error(`Model "${id}" failed validation:`, result.errors.join(' '));
      })
      .catch((err: unknown) => {
        console.error(`Could not load model "${id}":`, err);
      });
  };

  const handleChange = (id: string) => {
    if (!id || id === (ui.modelId ?? '')) return;
    if (ui.dirty) setPendingId(id);
    else selectModel(id);
  };

  const handleDiscard = () => {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    selectModel(id);
  };

  const handleSave = () => {
    if (!model || !ui.modelId) return;
    setSaving(true);
    void saveModel(ui.modelId, serializeModel(model, ui.colors)).then((ok) => {
      setSaving(false);
      if (ok) actions.markSaved();
      else console.error(`Failed to save model "${ui.modelId}".`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Model" className={selectClass} value={ui.modelId ?? ''} onChange={(e) => handleChange(e.target.value)}>
        <option value="" disabled>
          Select a model…
        </option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
          </option>
        ))}
      </select>

      {pendingId && (
        <div className={cn('flex items-center gap-2 rounded-md border border-yellow-600', 'bg-gray-900 px-2 py-1 text-sm text-gray-200')}>
          <span>Discard unsaved changes?</span>
          <button type="button" className="rounded-md px-2 py-1 text-sm text-gray-50 hover:bg-gray-800" onClick={handleDiscard}>
            Discard
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-800"
            onClick={() => setPendingId(null)}
          >
            Cancel
          </button>
        </div>
      )}

      <button type="button" className={btn} disabled title="lands with modals">
        New
      </button>

      <button
        type="button"
        className={cn(btn, 'inline-flex items-center gap-2')}
        disabled={!model || !ui.modelId || saving}
        onClick={handleSave}
      >
        {ui.dirty && <span className="h-2 w-2 rounded-full bg-yellow-400" aria-hidden="true" />}
        Save
      </button>
    </div>
  );
}
