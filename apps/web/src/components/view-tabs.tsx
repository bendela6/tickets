import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Board } from '../api/types';
import { useCreateView } from '../api/use-create-view';
import { usePatchView } from '../api/use-patch-view';

export function ViewTabs({
  projectKey,
  board,
  activeViewId,
}: {
  projectKey: string;
  board: Board;
  activeViewId: number | null;
}) {
  const navigate = useNavigate();
  const createView = useCreateView();
  const patchView = usePatchView();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  const views = board.views
    .filter((view) => !view.archivedAt)
    .sort((left, right) => left.position - right.position);
  const active = views.find((view) => view.id === activeViewId) ?? null;
  const inputStyle = {
    font: 'inherit',
    fontSize: 12.5,
    color: 'var(--ink)',
    background: 'var(--page)',
    border: '1px solid var(--ring)',
    borderRadius: 6,
    padding: '4px 8px',
  } as const;

  return (
    <div className="filters" style={{ margin: '14px 0 12px' }}>
      <div className="chipset">
        {views.map((view) => (
          <Link
            key={view.id}
            className={`chip${view.id === activeViewId ? ' on' : ''}`}
            to="/p/$projectKey/v/$viewId"
            params={{ projectKey, viewId: String(view.id) }}
          >
            {view.name}
          </Link>
        ))}
        {adding ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input
              style={inputStyle}
              autoFocus
              placeholder="view name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={async (event) => {
                if (event.key === 'Enter' && draft.trim().length > 0) {
                  const created = await createView.mutateAsync({
                    projectKey,
                    name: draft.trim(),
                  });
                  setAdding(false);
                  setDraft('');
                  void navigate({
                    to: '/p/$projectKey/v/$viewId',
                    params: { projectKey, viewId: String(created.id) },
                  });
                }
                if (event.key === 'Escape') {
                  setAdding(false);
                }
              }}
            />
          </span>
        ) : (
          <button type="button" className="chip" onClick={() => setAdding(true)}>
            + view
          </button>
        )}
      </div>
      {active ? (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {renaming ? (
            <input
              style={inputStyle}
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={async (event) => {
                if (event.key === 'Enter' && draft.trim().length > 0) {
                  await patchView.mutateAsync({ viewId: active.id, name: draft.trim() });
                  setRenaming(false);
                }
                if (event.key === 'Escape') {
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="btn"
              title="Rename view"
              onClick={() => {
                setDraft(active.name);
                setRenaming(true);
              }}
            >
              ✎
            </button>
          )}
          {views.length > 1 ? (
            <button
              type="button"
              className="btn"
              style={confirmArchive ? { color: 'var(--critical)' } : undefined}
              title="Archive view"
              onClick={async () => {
                if (!confirmArchive) {
                  setConfirmArchive(true);
                  return;
                }
                await patchView.mutateAsync({ viewId: active.id, archived: true });
                setConfirmArchive(false);
                const fallback = views.find((view) => view.id !== active.id);
                if (fallback) {
                  void navigate({
                    to: '/p/$projectKey/v/$viewId',
                    params: { projectKey, viewId: String(fallback.id) },
                  });
                }
              }}
            >
              {confirmArchive ? 'sure?' : '🗑'}
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
