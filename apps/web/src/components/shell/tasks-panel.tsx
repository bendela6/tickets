import { useState } from 'react';
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { useProjects } from '../../api/use-projects';
import { useProjectStats } from '../../api/use-project-stats';
import { cn, Progress, RailLabel } from '@tickets/ui';
import { NewProjectDialog } from './new-project-dialog';

function navItemClasses(active: boolean) {
  return cn(
    'flex h-32 items-center gap-8 rounded-lg px-9 font-sans text-13/19',
    active ? 'bg-surface-inset font-500 text-gray-12' : 'text-gray-11 hover:bg-surface-inset hover:text-gray-12',
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
        className="mb-8 flex h-32 cursor-pointer items-center gap-7 rounded-lg border-1 border-gray-6 bg-surface-raised px-10 hover:border-gray-7"
      >
        <span aria-hidden className="text-12/17 text-gray-9">
          ⌕
        </span>
        <span className="flex-1 text-left font-sans text-13/19 text-gray-9">Search…</span>
        <span className="rounded-sm border-1 border-gray-6 px-4 font-mono text-10 text-gray-9">
          ⌘K
        </span>
      </button>

      <button
        type="button"
        onClick={handleNewTicket}
        className="mb-14 h-34 rounded-lg bg-indigo-9 font-sans text-13/19 font-500 text-indigo-contrast hover:bg-indigo-10"
      >
        ＋ New item
      </button>

      <nav className="flex flex-col gap-2">
        <Link to="/" onClick={onNavigate} className={navItemClasses(Boolean(matchRoute({ to: '/' })))}>
          <span aria-hidden>⌂</span>
          <span className="flex-1">Home</span>
        </Link>
        <Link to="/all" onClick={onNavigate} className={navItemClasses(Boolean(matchRoute({ to: '/all' })))}>
          <span aria-hidden>▤</span>
          <span className="flex-1">All items</span>
          <span className="font-mono text-11 text-gray-9">{allCount || ''}</span>
        </Link>
      </nav>

      <RailLabel className="block px-9 pb-6 pt-16">PROJECTS</RailLabel>
      <div className="flex flex-col gap-2">
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
              <span className="rounded-sm bg-surface-inset px-5 py-2 font-mono text-10 font-500 text-gray-11">
                {project.itemPrefix}
              </span>
              <span className="flex-1 truncate">{project.name}</span>
              <Progress
                tone="green"
                value={stat?.pct ?? 0}
                className="w-26"
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
          className="flex h-30 cursor-pointer items-center gap-8 rounded-lg px-9 font-sans text-12/17 text-gray-9 hover:bg-surface-inset"
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
              className={cn(navItemClasses(false), 'mb-8 cursor-default opacity-60')}
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
            className={cn(navItemClasses(onSettings), 'mb-8')}
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
