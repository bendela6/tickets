import { useMemo } from 'react';
import { Link, createRoute } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { SettingsScreen } from '../components/settings/settings-screen';
import { AppShell } from '../components/shell/app-shell';
import { indexBoard } from '../utils/index-board';
import { rootRoute } from './root-route';

function SettingsPage() {
  const { projectKey } = settingsRoute.useParams();
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);

  return (
    <AppShell activeProjectKey={projectKey}>
      {boardQuery.isLoading ? (
        <p className="px-8 py-7 font-sans text-ui text-ink-3">Loading {projectKey} settings…</p>
      ) : boardQuery.isError || !board || !indexes ? (
        <div className="px-8 py-7">
          <p className="font-sans text-ui text-danger">
            Could not load project “{projectKey}” — {(boardQuery.error as Error | null)?.message}
          </p>
          <Link
            to="/"
            className="mt-3 inline-flex h-8 items-center rounded-[8px] border border-control bg-raised px-3 font-sans text-ui text-ink hover:bg-inset"
          >
            ← projects
          </Link>
        </div>
      ) : (
        <SettingsScreen board={board} indexes={indexes} projectKey={projectKey} />
      )}
    </AppShell>
  );
}

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'p/$projectKey/settings',
  component: SettingsPage,
});
