import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TabNav } from '@bh/shell/layout';
import type { Board } from '../api/types';
import { useCreateView } from '../api/use-create-view';
import { useCurrentUser } from '../state/current-user-context';
import { Button, Icon, Input } from '@bh/ui';

// A project's views as the tabs of its page header, each a route
// (/p/$projectKey/v/$viewId), with "New view" after the last one, which names
// a view inline and opens it. board.views arrives pre-filtered to unarchived
// views; sorted by id (creation order) since the view record carries no
// explicit position. On an item's page, under no view, no tab is lit.
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

  const newView = adding ? (
    <Input
      size="xs"
      autoFocus
      placeholder="view name"
      aria-label="New view name"
      value={draft}
      disabled={userId === null}
      className="w-144"
      onBlur={() => setAdding(false)}
      onChange={(next) => setDraft(next)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && draft.trim().length > 0 && userId !== null) {
          // A failure is toasted by MutationErrorToasts.
          createView.mutate(
            { projectKey, actorId: userId, name: draft.trim() },
            {
              onSuccess: (created) => {
                setAdding(false);
                setDraft('');
                void navigate({
                  to: '/p/$projectKey/v/$viewId',
                  params: { projectKey, viewId: String(created.id) },
                });
              },
            },
          );
        }
        if (event.key === 'Escape') {
          setAdding(false);
        }
      }}
    />
  ) : (
    <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
      <Icon name="plus" size="sm" />
      New view
    </Button>
  );

  return (
    <TabNav
      label="Views"
      tabs={views.map((view) => ({ to: `/p/$projectKey/v/${view.id}`, label: view.name }))}
      params={{ projectKey }}
      trailing={
        <>
          {newView}
          <span className="flex-1" />
          {active ? <span className="font-mono text-11 text-gray-9">view saved</span> : null}
        </>
      }
    />
  );
}
