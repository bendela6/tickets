import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Board } from '../api/types';
import { useCreateView } from '../api/use-create-view';
import { useCurrentUser } from '../state/current-user-context';
import { cn } from '@tickets/ui';
import { Input } from '../ui/input';

// Underline view tabs per docs/design/03-project-board.html lines 99–106:
// active = medium ink with a 2px accent underline overlapping the hairline,
// idle = regular ink-2; "＋" creates a view inline. board.views arrives
// pre-filtered to unarchived views; sorted by id (creation order) since the
// view record carries no explicit position.
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
  const { userId } = useCurrentUser();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const views = [...board.views].sort((left, right) => left.id - right.id);
  const active = views.find((view) => view.id === activeViewId) ?? null;

  return (
    <div className="mb-3 flex shrink-0 items-center gap-1.5 border-b border-gray-6">
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
                ? 'border-indigo-9 font-medium text-gray-12'
                : 'border-transparent text-gray-11 hover:text-gray-12',
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
          disabled={userId === null}
          className="mx-1 w-36"
          onBlur={() => setAdding(false)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={async (event) => {
            if (event.key === 'Enter' && draft.trim().length > 0 && userId !== null) {
              const created = await createView.mutateAsync({
                projectKey,
                actorId: userId,
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
          className="px-2.5 py-2 font-sans text-ui text-gray-9 hover:text-gray-12"
          onClick={() => setAdding(true)}
        >
          ＋
        </button>
      )}
      <span className="flex-1" />
      {active ? <span className="py-2 font-mono text-[11px] text-gray-9">view saved</span> : null}
    </div>
  );
}
