import { useMemo, useState } from 'react';
import { useBoard } from '../../api/use-board';
import { useForkScheme, useUpdateProject } from '../../api/use-admin';
import { useCurrentUser } from '../../state/current-user-context';
import { Button, Tabs, useToast } from '@tickets/ui';
import { indexBoard } from '../../utils/index-board';
import { FieldsTab } from './fields-tab';
import { LinksTab } from './links-tab';
import { TypesTab } from './types-tab';
import { WorkflowTab } from './workflow-tab';

type TabKey = 'types' | 'fields' | 'workflow' | 'links';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'types', label: 'Types' },
  { key: 'fields', label: 'Fields' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'links', label: 'Links' },
];

// The schema admin shell per the approved prototype: a scheme banner above a
// left-rail tab switcher (Types · Fields · Workflow · Links). The four panels
// are thin placeholders here — Tasks 10-13 fill each in behind its own file.
//
// The board payload carries no scheme *name* (only `project.schemeId` — see
// `apps/web/src/api/types.ts`), so the banner labels the scheme by id rather
// than inventing a name field that doesn't exist on the wire. Likewise there's
// no project-count-per-scheme on the board, so the banner doesn't claim a
// specific N; it says "all projects on this scheme" instead.
export function SettingsScreen({ projectKey }: { projectKey: string }) {
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);
  const [tab, setTab] = useState<TabKey>('types');
  const { userId } = useCurrentUser();
  const forkScheme = useForkScheme();
  const updateProject = useUpdateProject();
  const { toast } = useToast();

  async function handleFork() {
    if (userId === null || !board) return;
    const confirmed = window.confirm(
      `Fork the shared scheme so future changes only affect "${board.project.name}"? Other projects on this scheme are unaffected.`,
    );
    if (!confirmed) return;
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

  if (boardQuery.isLoading) {
    return <p className="px-8 py-7 font-sans text-13/19 text-gray-9">Loading {projectKey} settings…</p>;
  }
  if (boardQuery.isError || !board || !indexes) {
    return (
      <p className="px-8 py-7 font-sans text-13/19 text-red-9">
        Could not load project "{projectKey}" — {(boardQuery.error as Error | null)?.message}
      </p>
    );
  }

  const tabProps = { board, indexes, projectKey };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* scheme banner */}
      <div className="flex flex-none items-center gap-3 border-b border-gray-6 bg-surface-inset px-6 py-3">
        <p className="m-0 flex-1 font-sans text-13/19 text-gray-11">
          Editing the shared scheme <span className="font-500 text-gray-12">#{board.project.schemeId}</span> —
          changes affect all projects on this scheme.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={userId === null || forkScheme.isPending || updateProject.isPending}
          title={userId === null ? 'Sign in to fork the scheme' : undefined}
          onClick={handleFork}
        >
          Fork for this project
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Settings sections"
          className="w-53 flex-none overflow-y-auto border-r border-gray-6 bg-gray-1 px-3 py-5.5"
        >
          <Tabs
            variant="rail"
            items={TABS.map(({ key, label }) => ({ value: key, label }))}
            value={tab}
            onChange={(next) => setTab(next as TabKey)}
          />
        </nav>

        <div role="tabpanel" className="min-w-0 flex-1 overflow-y-auto">
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
          ) : (
            <LinksTab key={board.project.schemeId} {...tabProps} />
          )}
        </div>
      </div>
    </div>
  );
}
