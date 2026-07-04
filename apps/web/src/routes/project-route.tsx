import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, createRoute, useParams } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { AppHeader } from '../components/app-header';
import { NewTicketDialog } from '../components/new-ticket-dialog';
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

  if (boardQuery.isLoading) {
    return (
      <div className="wrap">
        <p style={{ color: 'var(--muted)' }}>Loading {projectKey}…</p>
      </div>
    );
  }
  if (boardQuery.isError || !board || !indexes) {
    return (
      <div className="wrap">
        <p style={{ color: 'var(--critical)' }}>
          Could not load project “{projectKey}” — {(boardQuery.error as Error | null)?.message}
        </p>
        <Link className="btn" to="/" onClick={() => writeLocal(STORAGE_KEYS.lastProject, '')}>
          ← projects
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap">
      <AppHeader projectKey={projectKey} board={board} onNewTicket={() => setDialogOpen(true)} />
      <ViewTabs
        projectKey={projectKey}
        board={board}
        activeViewId={childParams.viewId ? Number(childParams.viewId) : null}
      />
      <Outlet />
      <NewTicketDialog
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'p/$projectKey',
  component: ProjectLayout,
});
