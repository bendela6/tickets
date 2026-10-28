import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, createRoute, useParams } from '@tanstack/react-router';
import { writeStored } from '@tilewise/hooks';
import { Page, PageBody, PageHeader } from '@tilewise/shell/layout';
import { Button, Icon, ScreenState } from '@tilewise/ui';
import { useBoard } from '../api/use-board';
import { ProjectRepository } from '../components/board/project-repository';
import { NewItemDialog } from '../components/new-item-dialog';
import { ViewTabs } from '../components/view-tabs';
import { boardProgress } from '../utils/board-progress';
import { STORAGE_KEYS } from '../utils/storage-keys';
import { indexBoard } from '../utils/index-board';
import { rootRoute } from './root-route';

const PROJECTS_CRUMB = [{ label: 'Projects', path: '/' }];

// A project's page: its header (the name, how far along it is, its
// repository, "New item", and its views as tabs) over the view or the item
// on screen.
function ProjectLayout() {
  const { projectKey } = projectRoute.useParams();
  const childParams = useParams({ strict: false }) as { viewId?: string };
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    writeStored(STORAGE_KEYS.lastProject, projectKey);
  }, [projectKey]);

  if (boardQuery.isLoading) {
    return (
      <Page header={<PageHeader title={projectKey} breadcrumb={PROJECTS_CRUMB} />}>
        <PageBody>
          <ScreenState title={`Loading ${projectKey}…`} />
        </PageBody>
      </Page>
    );
  }
  if (boardQuery.isError || !board || !indexes) {
    return (
      <Page header={<PageHeader title={projectKey} breadcrumb={PROJECTS_CRUMB} />}>
        <PageBody>
          <ScreenState
            tone="danger"
            icon="triangle-alert"
            title={`Could not load project “${projectKey}”`}
            body={(boardQuery.error as Error | null)?.message}
            action={
              <Link
                to="/"
                className="inline-flex h-32 w-max items-center rounded-8 border-1 border-gray-7 bg-surface-raised px-12 font-sans text-13/19 text-gray-12 hover:bg-surface-inset"
              >
                ← projects
              </Link>
            }
          />
        </PageBody>
      </Page>
    );
  }

  const { count, donePercent } = boardProgress(board, indexes);
  return (
    <Page
      header={
        <PageHeader
          title={board.project.name}
          breadcrumb={PROJECTS_CRUMB}
          description={
            <span className="flex flex-col gap-4">
              <span className="font-mono text-12/17 text-gray-9">
                {board.project.itemPrefix} · {count} items · {donePercent}% done
              </span>
              <ProjectRepository project={board.project} />
            </span>
          }
          actions={
            <Button variant="solid" size="sm" onClick={() => setDialogOpen(true)}>
              <Icon name="plus" size="sm" />
              New item
            </Button>
          }
          tabs={
            <ViewTabs
              projectKey={projectKey}
              board={board}
              activeViewId={childParams.viewId ? Number(childParams.viewId) : null}
            />
          }
        />
      }
    >
      {/* No gap of its own, and no bottom gutter: a view's table runs to the
          window's foot, as a sheet. */}
      <PageBody className="min-h-0 flex-1 gap-0 pb-0 md:pb-0">
        <Outlet />
      </PageBody>
      <NewItemDialog
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </Page>
  );
}

export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'p/$projectKey',
  component: ProjectLayout,
});
