import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Board } from '../api/types';
import { useCreateView } from '../api/use-create-view';
import { cn } from '../ui/cn';
import { Input } from '../ui/input';
import { relativeLabel } from '../ui/relative-date';

// Underline view tabs per docs/design/03-project-board.html lines 99–106:
// active = medium ink with a 2px accent underline overlapping the hairline,
// idle = regular ink-2; "＋" creates a view inline.
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
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const views = board.views
    .filter((view) => !view.archivedAt)
    .sort((left, right) => left.position - right.position);
  const active = views.find((view) => view.id === activeViewId) ?? null;

  return (
    <div className="mb-3 flex shrink-0 items-center gap-1.5 border-b border-hairline">
      {views.map((view) => {
        const isActive = view.id === activeViewId;
        return (
          <Link
            key={view.id}
            to="/p/$projectKey/v/$viewId"
            params={{ projectKey, viewId: String(view.id) }}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 font-sans text-ui',
              isActive
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {view.name}
          </Link>
        );
      })}
      {adding ? (
        <Input
          size="compact"
          autoFocus
          placeholder="view name"
          aria-label="New view name"
          value={draft}
          className="mx-1 w-36"
          onBlur={() => setAdding(false)}
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
      ) : (
        <button
          type="button"
          aria-label="New view"
          className="px-2.5 py-2 font-sans text-ui text-ink-3 hover:text-ink"
          onClick={() => setAdding(true)}
        >
          ＋
        </button>
      )}
      <span className="flex-1" />
      {active ? (
        <span className="py-2 font-mono text-[11px] text-ink-3">
          view saved · created {relativeLabel(active.createdAt, new Date())}
        </span>
      ) : null}
    </div>
  );
}
