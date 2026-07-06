import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, createRoute, useParams } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { NewTicketDialog } from '../components/new-ticket-dialog';
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
        <p className="px-8 py-7 font-sans text-ui text-ink-3">Loading {projectKey}…</p>
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
        // Instrument board area — deliberately NOT inside .wrap (legacy
        // globals.css scoping); design main padding is 22px 28px 0.
        <div className="flex h-full min-h-0 flex-col px-7 pt-5.5">
          <ViewTabs
            projectKey={projectKey}
            board={board}
            activeViewId={childParams.viewId ? Number(childParams.viewId) : null}
          />
          <Outlet />
          {/* Legacy dialog keeps its globals.css styling until Phase 5. */}
          <div className="wrap">
            <NewTicketDialog
              projectKey={projectKey}
              board={board}
              indexes={indexes}
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
            />
          </div>
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
