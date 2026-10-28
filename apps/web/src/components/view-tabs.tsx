import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TabNav } from '@tilewise/shell/layout';
import type { Board } from '../api/types';
import { useCreateView } from '../api/use-create-view';
import { useCurrentUser } from '../state/current-user-context';
import { Button, Icon, Input } from '@tilewise/ui';

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
  // The name being created, which the field shows while the request is out.
  const [creating, setCreating] = useState('');

  const views = [...board.views].sort((left, right) => left.id - right.id);
  const active = views.find((view) => view.id === activeViewId) ?? null;

  const create = (next: string) => {
    const name = next.trim();
    if (name.length === 0 || userId === null) {
      return;
    }
    setCreating(name);
    // A failure is toasted by MutationErrorToasts.
    createView.mutate(
      { projectKey, actorId: userId, name },
      {
        onSuccess: (created) => {
          setAdding(false);
          void navigate({
            to: '/p/$projectKey/v/$viewId',
            params: { projectKey, viewId: String(created.id) },
          });
        },
        onSettled: () => setCreating(''),
      },
    );
  };

  // bh's Input holds the name as a draft (`commit="leave"`): Enter or leaving
  // the field creates the view, Escape drops the name, and leaving closes the
  // field either way.
  const newView = adding ? (
    <Input
      size="xs"
      autoFocus
      placeholder="view name"
      aria-label="New view name"
      commit="leave"
      value={creating}
      disabled={userId === null}
      className="w-144"
      onChange={create}
      onBlur={() => setAdding(false)}
      onKeyDown={(event) => {
        // The Input has already created on Enter and dropped the name on
        // Escape; this only closes the field.
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
