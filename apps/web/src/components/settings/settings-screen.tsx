import { useMemo, useState } from 'react';
import { useBoard } from '../../api/use-board';
import { useForkScheme, useUpdateProject } from '../../api/use-admin';
import { useCurrentUser } from '../../state/current-user-context';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';
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
    const forked = (await forkScheme.mutateAsync({
      actorId: userId,
      sourceSchemeId: board.project.schemeId,
      key,
      name,
    })) as { schemeId: number };
    await updateProject.mutateAsync({ actorId: userId, id: board.project.id, schemeId: forked.schemeId });
  }

  if (boardQuery.isLoading) {
    return <p className="px-8 py-7 font-sans text-ui text-ink-3">Loading {projectKey} settings…</p>;
  }
  if (boardQuery.isError || !board || !indexes) {
    return (
      <p className="px-8 py-7 font-sans text-ui text-danger">
        Could not load project "{projectKey}" — {(boardQuery.error as Error | null)?.message}
      </p>
    );
  }

  const tabProps = { board, indexes, projectKey };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* scheme banner */}
      <div className="flex flex-none items-center gap-3 border-b border-hairline bg-inset px-6 py-3">
        <p className="m-0 flex-1 font-sans text-ui text-ink-2">
          Editing the shared scheme <span className="font-medium text-ink">#{board.project.schemeId}</span> —
          changes affect all projects on this scheme.
        </p>
        <Button
          variant="secondary"
          size="compact"
          disabled={userId === null || forkScheme.isPending || updateProject.isPending}
          title={userId === null ? 'Sign in to fork the scheme' : undefined}
          onClick={handleFork}
        >
          Fork for this project
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          role="tablist"
          aria-label="Settings sections"
          className="flex w-53 flex-none flex-col gap-0.5 overflow-y-auto border-r border-hairline bg-app px-3 py-5.5"
        >
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={cn(
                  'flex h-7.5 shrink-0 cursor-pointer items-center rounded-[7px] px-2.25 text-left font-sans text-ui',
                  active ? 'bg-inset font-medium text-ink' : 'text-ink-2 hover:bg-inset hover:text-ink',
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div role="tabpanel" className="min-w-0 flex-1 overflow-y-auto">
          {tab === 'types' ? (
            <TypesTab {...tabProps} />
          ) : tab === 'fields' ? (
            <FieldsTab {...tabProps} />
          ) : tab === 'workflow' ? (
            <WorkflowTab {...tabProps} />
          ) : (
            <LinksTab {...tabProps} />
          )}
        </div>
      </div>
    </div>
  );
}
