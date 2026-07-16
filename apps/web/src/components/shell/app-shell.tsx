import { useState, type ReactNode } from 'react';
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
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
// sidebar (nav, projects, actor footer) + scrollable main. Below md the
// sidebar collapses into a top bar (☰ menu · logo · ＋ new ticket) and the
// same sidebar content opens as a slide-over panel. Screens render their own
// padding inside `children`.
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
  const matchRoute = useMatchRoute();
  const projects = useProjects();
  const projectList = projects.data?.data ?? [];
  const stats = useProjectStats(projectList);
  const statsByKey = new Map(
    stats.flatMap((query) => (query.data ? [[query.data.project.key, query.data] as const] : [])),
  );
  const allCount = stats.reduce((sum, query) => sum + (query.data?.total ?? 0), 0);
  const [creatingProject, setCreatingProject] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light');

  const handleNewTicket = () => {
    setMobileNavOpen(false);
    if (onNewTicket) {
      onNewTicket();
      return;
    }
    const first = activeProjectKey ?? projectList[0]?.key;
    if (first) {
      void navigate({ to: '/p/$projectKey', params: { projectKey: first } });
    }
  };

  // Rendered twice: inside the desktop <aside> and the mobile slide-over.
  const sidebarContent = (
    <>
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
        onClick={handleNewTicket}
        className="mb-3.5 h-8.5 rounded-[8px] bg-accent font-sans text-ui font-medium text-on-accent hover:bg-accent-hover"
      >
        ＋ New ticket
      </button>

      <nav className="flex flex-col gap-0.5">
        <Link to="/" className={navItemClasses(Boolean(matchRoute({ to: '/' })))}>
          <span aria-hidden>⌂</span>
          <span className="flex-1">Home</span>
        </Link>
        <Link to="/all" className={navItemClasses(Boolean(matchRoute({ to: '/all' })))}>
          <span aria-hidden>▤</span>
          <span className="flex-1">All tickets</span>
          <span className="font-mono text-[11px] text-ink-3">{allCount || ''}</span>
        </Link>
        <Link to="/ai" className={navItemClasses(Boolean(matchRoute({ to: '/ai' })))}>
          <span aria-hidden>▷_</span>
          <span className="flex-1">AI sessions</span>
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
          onClick={() => {
            setMobileNavOpen(false);
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
            className={cn(navItemClasses(onSettings), 'mb-2')}
          >
            <span aria-hidden>⚙</span>
            <span className="flex-1">Settings</span>
          </Link>
        );
      })()}
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
    </>
  );

  return (
    <div className="flex h-screen flex-col bg-app font-sans text-ink md:flex-row">
      {/* Mobile top bar (below md): menu · logo · spacer · new ticket. */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-hairline bg-app px-2 md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-[8px] font-sans text-[17px] text-ink-2 hover:bg-inset"
        >
          ☰
        </button>
        <Link to="/" className="flex items-center gap-2 px-1">
          <span aria-hidden className="size-2.25 rounded-[2px] bg-accent" />
          <span className="font-mono text-[15px] font-semibold text-ink">tickets</span>
        </Link>
        <span className="flex-1" />
        <button
          type="button"
          aria-label="New ticket"
          onClick={handleNewTicket}
          className="inline-flex size-9 items-center justify-center rounded-[8px] bg-accent font-sans text-[16px] text-on-accent hover:bg-accent-hover"
        >
          ＋
        </button>
      </div>

      <aside className="hidden w-59 flex-none flex-col overflow-y-auto border-r border-hairline px-3 pb-3 pt-3.5 md:flex">
        {sidebarContent}
      </aside>

      {mobileNavOpen ? (
        <div className="md:hidden">
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            aria-label="Navigation"
            // Delegated close: any nav link tap dismisses the slide-over.
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest('a')) {
                setMobileNavOpen(false);
              }
            }}
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-hairline bg-app px-3 pb-3 pt-3.5 shadow-lg"
          >
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>

      <NewProjectDialog open={creatingProject} onOpenChange={setCreatingProject} />
    </div>
  );
}
