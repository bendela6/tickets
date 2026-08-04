import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, createRoute, useParams } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { NewItemDialog } from '../components/new-item-dialog';
import { AppShell } from '../components/shell/app-shell';
import { ViewTabs } from '../components/view-tabs';
import { STORAGE_KEYS } from '../utils/storage-keys';
import { indexBoard } from '../utils/index-board';
import { writeLocal } from '../utils/write-local';
import { rootRoute } from './root-route';

function ProjectLayout() {
  const { projectKey } = projectRoute.useParams();
  const childParams = useParams({ strict: false }) as { viewId?: string };
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    writeLocal(STORAGE_KEYS.lastProject, projectKey);
  }, [projectKey]);

  return (
    <AppShell activeProjectKey={projectKey} onNewTicket={() => setDialogOpen(true)}>
      {boardQuery.isLoading ? (
        <p className="px-32 py-28 font-sans text-13/19 text-gray-9">Loading {projectKey}…</p>
      ) : boardQuery.isError || !board || !indexes ? (
        <div className="px-32 py-28">
          <p className="font-sans text-13/19 text-red-9">
            Could not load project “{projectKey}” — {(boardQuery.error as Error | null)?.message}
          </p>
          <Link
            to="/"
            className="mt-12 inline-flex h-32 items-center rounded-lg border-1 border-gray-7 bg-surface-raised px-12 font-sans text-13/19 text-gray-12 hover:bg-surface-inset"
          >
            ← projects
          </Link>
        </div>
      ) : (
        // Instrument board area; design main padding is 22px 28px 0 on
        // desktop, tightened below md for 390px screens.
        <div className="flex h-full min-h-0 flex-col px-16 pt-16 md:px-28 md:pt-22">
          <ViewTabs
            projectKey={projectKey}
            board={board}
            activeViewId={childParams.viewId ? Number(childParams.viewId) : null}
          />
          <Outlet />
          <NewItemDialog
            projectKey={projectKey}
            board={board}
            indexes={indexes}
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
          />
        </div>
      )}
    </AppShell>
  );
}

export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'p/$projectKey',
  component: ProjectLayout,
});
