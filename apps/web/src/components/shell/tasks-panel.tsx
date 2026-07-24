import { useState } from 'react';
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { useProjects } from '../../api/use-projects';
import { useProjectStats } from '../../api/use-project-stats';
import { cn } from '@tickets/ui/cn';
import { Meter } from '@tickets/ui/meter';
import { NewProjectDialog } from './new-project-dialog';

function navItemClasses(active: boolean) {
  return cn(
    'flex h-8 items-center gap-2 rounded-[7px] px-2.25 font-sans text-ui',
    active ? 'bg-inset font-medium text-ink' : 'text-ink-2 hover:bg-inset hover:text-ink',
  );
}

// The "tasks" mode panel: search, ＋ New item, Home/All-items nav, the
// PROJECTS list, and Settings. Lifted verbatim from AppShell's former
// sidebarContent (the old `/ai` "AI sessions" link is dropped — the activity
// rail replaces it). `onNavigate` closes the mobile slide-over on tap.
export function TasksPanel({
  activeProjectKey,
  onNewTicket,
  onNavigate,
}: {
  activeProjectKey?: string;
  onNewTicket?: () => void;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const projects = useProjects();
  const projectList = projects.data?.data ?? [];
  const stats = useProjectStats(projectList);
  const statsByKey = new Map(
    stats.flatMap((query) => (query.data ? [[query.data.project.key, query.data] as const] : [])),
  );
  const allCount = stats.reduce((sum, query) => sum + (query.data?.total ?? 0), 0);
  const [creatingProject, setCreatingProject] = useState(false);

  const handleNewTicket = () => {
    onNavigate?.();
    if (onNewTicket) {
      onNewTicket();
      return;
    }
    const first = activeProjectKey ?? projectList[0]?.key;
    if (first) {
      void navigate({ to: '/p/$projectKey', params: { projectKey: first } });
    }
  };

  return (
    <>
      <button
        type="button"
        title="Command palette (coming soon)"
        className="mb-2 flex h-8 cursor-pointer items-center gap-1.75 rounded-[8px] border border-hairline bg-raised px-2.5 hover:border-control"
      >
        <span aria-hidden className="text-meta text-ink-3">
          ⌕
        </span>
        <span className="flex-1 text-left font-sans text-ui text-ink-3">Search…</span>
        <span className="rounded-[4px] border border-hairline px-1 font-mono text-[10px] text-ink-3">
          ⌘K
        </span>
      </button>

      <button
        type="button"
        onClick={handleNewTicket}
        className="mb-3.5 h-8.5 rounded-[8px] bg-accent font-sans text-ui font-medium text-on-accent hover:bg-accent-hover"
      >
        ＋ New item
      </button>

      <nav className="flex flex-col gap-0.5">
        <Link to="/" onClick={onNavigate} className={navItemClasses(Boolean(matchRoute({ to: '/' })))}>
          <span aria-hidden>⌂</span>
          <span className="flex-1">Home</span>
        </Link>
        <Link to="/all" onClick={onNavigate} className={navItemClasses(Boolean(matchRoute({ to: '/all' })))}>
          <span aria-hidden>▤</span>
          <span className="flex-1">All items</span>
          <span className="font-mono text-[11px] text-ink-3">{allCount || ''}</span>
        </Link>
      </nav>

      <div className="px-2.25 pb-1.5 pt-4 font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">
        PROJECTS
      </div>
      <div className="flex flex-col gap-0.5">
        {projectList.map((project) => {
          const stat = statsByKey.get(project.key);
          return (
            <Link
              key={project.id}
              to="/p/$projectKey"
              params={{ projectKey: project.key }}
              onClick={onNavigate}
              className={navItemClasses(project.key === activeProjectKey)}
            >
              <span className="rounded-[4px] bg-inset px-1.25 py-0.5 font-mono text-[10px] font-medium text-ink-2">
                {project.itemPrefix}
              </span>
              <span className="flex-1 truncate">{project.name}</span>
              <Meter
                tone="green"
                value={stat?.pct ?? 0}
                max={100}
                className="w-6.5"
                trackClassName="min-w-0"
              />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            setCreatingProject(true);
          }}
          className="flex h-7.5 cursor-pointer items-center gap-2 rounded-[7px] px-2.25 font-sans text-meta text-ink-3 hover:bg-inset"
        >
          ＋<span>New project</span>
        </button>
      </div>

      <span className="flex-1" />

      {(() => {
        const settingsProjectKey = activeProjectKey ?? projectList[0]?.key;
        if (!settingsProjectKey) {
          return (
            <div
              className={cn(navItemClasses(false), 'mb-2 cursor-default opacity-60')}
              title="Settings — create a project first"
            >
              <span aria-hidden>⚙</span>
              <span className="flex-1">Settings</span>
            </div>
          );
        }
        const onSettings = Boolean(matchRoute({ to: '/p/$projectKey/settings' }));
        return (
          <Link
            to="/p/$projectKey/settings"
            params={{ projectKey: settingsProjectKey }}
            onClick={onNavigate}
            className={cn(navItemClasses(onSettings), 'mb-2')}
          >
            <span aria-hidden>⚙</span>
            <span className="flex-1">Settings</span>
          </Link>
        );
      })()}

      <NewProjectDialog open={creatingProject} onOpenChange={setCreatingProject} />
    </>
  );
}
