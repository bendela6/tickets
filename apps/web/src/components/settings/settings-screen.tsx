import { OWN_ERROR } from '../../api/mutation-meta';
import { useMemo } from 'react';
import { Page, PageBody, PageHeader } from '@tilewise/shell/layout';
import { useBoard } from '../../api/use-board';
import { useForkScheme, useUpdateProject } from '../../api/use-admin';
import { useCurrentUser } from '../../state/current-user-context';
import { Button, ScreenState, useConfirm, useToast } from '@tilewise/ui';
import { DisabledReason } from '../disabled-reason';
import { indexBoard } from '../../utils/index-board';
import { FieldsTab } from './fields-tab';
import { LinksTab } from './links-tab';
import { RepositoryTab } from './repository-tab';
import type { SettingsTab } from './settings-tabs';
import { TypesTab } from './types-tab';
import { WorkflowTab } from './workflow-tab';

const PROJECTS_CRUMB = { label: 'Projects', path: '/' };

// A project's settings page: its header says which scheme the four scheme
// tabs edit (and offers to fork it), over the tab on screen. Which tab that
// is is the route's: each is a route of its own (routes/settings-route.tsx),
// and the sidebar lists them under Settings (components/shell/use-nav.ts).
//
// The board payload carries no scheme *name* (only `project.schemeId` — see
// `apps/web/src/api/types.ts`), so the banner labels the scheme by id rather
// than inventing a name field that doesn't exist on the wire. Likewise there's
// no project-count-per-scheme on the board, so the banner doesn't claim a
// specific N; it says "all projects on this scheme" instead.
export function SettingsScreen({ projectKey, tab }: { projectKey: string; tab: SettingsTab }) {
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);
  const { userId } = useCurrentUser();
  const forkScheme = useForkScheme(OWN_ERROR);
  const updateProject = useUpdateProject(OWN_ERROR);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  async function handleFork() {
    if (userId === null || !board) return;
    // Not destructive: a fork copies the scheme, and nothing is lost.
    if (
      !(await confirm({
        title: 'Fork the shared scheme?',
        body: `"${board.project.name}" gets its own copy of the scheme, so future changes here affect it alone. Other projects on this scheme are unaffected.`,
        confirmLabel: 'Fork',
      }))
    ) {
      return;
    }
    // Derive a fresh, collision-free scheme key/name from the project's own
    // key/name — a timestamp suffix lets the same project fork more than
    // once without tripping the schemes.key unique constraint.
    const suffix = Date.now().toString(36);
    const key = `${board.project.key.toLowerCase()}-${suffix}`;
    const name = `${board.project.name} (forked)`;
    try {
      const forked = (await forkScheme.mutateAsync({
        actorId: userId,
        sourceSchemeId: board.project.schemeId,
        key,
        name,
      })) as { schemeId: number };
      await updateProject.mutateAsync({ actorId: userId, id: board.project.id, schemeId: forked.schemeId });
    } catch (error) {
      // A rejection here (either the fork POST or the repoint PATCH) must
      // not be an unhandled promise rejection with zero feedback — and if
      // the fork succeeded but the repoint failed, the new scheme is
      // orphaned (forked but never attached to a project), which is worth
      // surfacing distinctly since a retry would fork *again*.
      toast({
        title:
          error instanceof Error
            ? `Fork failed: ${error.message}`
            : 'Fork failed. Please try again.',
      });
    }
  }

  if (boardQuery.isLoading || boardQuery.isError || !board || !indexes) {
    return (
      <Page header={<PageHeader title="Settings" breadcrumb={[PROJECTS_CRUMB]} />}>
        <PageBody>
          {boardQuery.isLoading ? (
            <ScreenState title={`Loading ${projectKey} settings…`} />
          ) : (
            <ScreenState
              tone="danger"
              icon="triangle-alert"
              title={`Could not load project “${projectKey}”`}
              body={(boardQuery.error as Error | null)?.message}
            />
          )}
        </PageBody>
      </Page>
    );
  }

  const tabProps = { board, indexes, projectKey };
  const onScheme = tab !== 'repository';

  return (
    <Page
      header={
        <PageHeader
          title="Settings"
          breadcrumb={[PROJECTS_CRUMB, { label: board.project.name, path: `/p/${projectKey}` }]}
          description={
            // The scheme banner, on the four scheme tabs only: the repository
            // is the project's own.
            onScheme ? (
              <>
                Editing the shared scheme <span className="font-500 text-gray-12">#{board.project.schemeId}</span> —
                changes affect all projects on this scheme.
              </>
            ) : undefined
          }
          actions={
            onScheme ? (
              <DisabledReason reason={userId === null ? 'Sign in to fork the scheme' : undefined}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userId === null || forkScheme.isPending || updateProject.isPending}
                  onClick={handleFork}
                >
                  Fork for this project
                </Button>
              </DisabledReason>
            ) : null
          }
        />
      }
    >
      <PageBody>
        {/*
          Keyed on the scheme id: each panel seeds local state (chip
          selections, the selected-type picker, etc.) from the board on
          mount, keyed by *type* ids. Forking re-inserts every type under
          fresh ids (see schemeFork in
          apps/api/src/command/config/scheme.ts) and repoints the project
          without navigating away, so without this key the panels would
          keep their stale, now-mismatched selections after the board
          refetch — silently re-seeding from a scheme that no longer
          applies. The key forces a clean remount so each panel re-derives
          its state from the *new* board.
        */}
        {tab === 'types' ? (
          <TypesTab key={board.project.schemeId} {...tabProps} />
        ) : tab === 'fields' ? (
          <FieldsTab key={board.project.schemeId} {...tabProps} />
        ) : tab === 'workflow' ? (
          <WorkflowTab key={board.project.schemeId} {...tabProps} />
        ) : tab === 'links' ? (
          <LinksTab key={board.project.schemeId} {...tabProps} />
        ) : (
          <RepositoryTab {...tabProps} />
        )}
      </PageBody>
    </Page>
  );
}
