// Create a brand-new model from a title, seeded with a tiny starter fixture
// (one group, one entity, one pk field) so the freshly-created diagram isn't
// blank. Split out of model-modal.tsx (which owns edit/delete of the *current*
// model) purely to keep both files near the ~120-line guideline — the two
// share this seededRaw() bootstrap fixture.

import { useState } from 'react';

import { createModel } from '../../api/models-client';
import { loadModel } from '../../engine/model/load-model';
import { useDiagramActions } from '../../state/diagram-context';
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
