import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useProjects } from '../../api/use-projects';
import { useProjectStats } from '../../api/use-project-stats';
import { applyTheme } from '../../utils/apply-theme';
import { cn } from '../../ui/cn';
import { ActorMenu } from './actor-menu';
import { NewProjectDialog } from './new-project-dialog';

function navItemClasses(active: boolean) {
  return cn(
    'flex h-8 items-center gap-2 rounded-[7px] px-2.25 font-sans text-ui',
    active ? 'bg-inset font-medium text-ink' : 'text-ink-2 hover:bg-inset hover:text-ink',
  );
}

// The application frame per docs/design/01-shell-home.html: fixed 236px
// sidebar (nav, projects, actor footer) + scrollable main. Screens render
// their own padding inside `children`.
export function AppShell({
  activeProjectKey,
  onNewTicket,
  children,
}: {
  activeProjectKey?: string;
  onNewTicket?: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const projects = useProjects();
  const projectList = projects.data?.data ?? [];
  const stats = useProjectStats(projectList);
  const statsByKey = new Map(
    stats.flatMap((query) => (query.data ? [[query.data.project.key, query.data] as const] : [])),
  );
  const allCount = stats.reduce((sum, query) => sum + (query.data?.total ?? 0), 0);
  const [creatingProject, setCreatingProject] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light');

  return (
    <div className="flex h-screen bg-app font-sans text-ink">
      <aside className="flex w-59 flex-none flex-col overflow-y-auto border-r border-hairline px-3 pb-3 pt-3.5">
        <Link to="/" className="flex items-center gap-2 px-2 pb-3.5 pt-1">
          <span aria-hidden className="size-2.25 rounded-[2px] bg-accent" />
          <span className="font-mono text-[15px] font-semibold text-ink">tickets</span>
        </Link>

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
          onClick={() => {
            if (onNewTicket) {
              onNewTicket();
              return;
            }
            const first = activeProjectKey ?? projectList[0]?.key;
            if (first) {
              void navigate({ to: '/p/$projectKey', params: { projectKey: first } });
            }
          }}
          className="mb-3.5 h-8.5 rounded-[8px] bg-accent font-sans text-ui font-medium text-on-accent hover:bg-accent-hover"
        >
          ＋ New ticket
        </button>

        <nav className="flex flex-col gap-0.5">
          <Link to="/" className={navItemClasses(!activeProjectKey)}>
            <span aria-hidden>⌂</span>
            <span className="flex-1">Home</span>
          </Link>
          <div
            className={cn(navItemClasses(false), 'cursor-default opacity-60')}
            title="All tickets — coming in a later phase"
          >
            <span aria-hidden>▤</span>
            <span className="flex-1">All tickets</span>
            <span className="font-mono text-[11px] text-ink-3">{allCount || ''}</span>
          </div>
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
                className={navItemClasses(project.key === activeProjectKey)}
              >
                <span className="rounded-[4px] bg-inset px-1.25 py-0.5 font-mono text-[10px] font-medium text-ink-2">
                  {project.ticketPrefix}
                </span>
                <span className="flex-1 truncate">{project.name}</span>
                <span className="inline-flex h-0.75 w-6.5 overflow-hidden rounded-[2px] bg-hairline">
                  <span className="bg-kind-done" style={{ width: `${stat?.pct ?? 0}%` }} />
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setCreatingProject(true)}
            className="flex h-7.5 cursor-pointer items-center gap-2 rounded-[7px] px-2.25 font-sans text-meta text-ink-3 hover:bg-inset"
          >
            ＋<span>New project</span>
          </button>
        </div>

        <span className="flex-1" />

        <div
          className={cn(navItemClasses(false), 'mb-2 cursor-default opacity-60')}
          title="Settings — coming in a later phase"
        >
          <span aria-hidden>⚙</span>
          <span className="flex-1">Settings</span>
        </div>
        <div className="flex items-center gap-2 border-t border-hairline pt-2.5">
          <ActorMenu />
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark';
              applyTheme(next);
              setTheme(next);
            }}
            className="inline-flex h-9.5 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-hairline bg-raised font-sans text-ui text-ink-2 hover:border-control"
          >
            ◐
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>

      <NewProjectDialog open={creatingProject} onOpenChange={setCreatingProject} />
    </div>
  );
}
