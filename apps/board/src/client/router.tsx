import { useQuery } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { Pill, Progress, ScreenState, Spinner, StatusDot, Tabs } from '@tickets/ui';
import type { SessionDetail } from '../shared/types';
import { boardQuery, duration, relative, sessionQuery } from './api';
import { DecisionsPanel } from './components/decisions-panel';
import { FeaturesPanel } from './components/features-panel';
import { SessionNav } from './components/session-nav';
import { ActivityPanel, GitPanel, PromptsPanel } from './components/simple-panels';
import { SessionTitle } from './components/session-title';
import { rollup } from './components/task-row';
import { TasksPanel } from './components/tasks-panel';

const TABS = ['features', 'tasks', 'prompts', 'git', 'decisions', 'activity'] as const;
type TabName = (typeof TABS)[number];

// The nav lives in the root route so switching sessions never remounts it — the list
// keeps its scroll position and the filter keeps its value.
const rootRoute = createRootRoute({
  component: function Shell() {
    const { data: board } = useQuery(boardQuery());
    const params = useParams({ strict: false }) as { id?: string };

    return (
      <div className="grid h-full grid-cols-[300px_minmax(0,1fr)] max-md:grid-cols-1 max-md:grid-rows-[auto_1fr]">
        {board ? <SessionNav board={board} activeId={params.id} /> : <div />}
        <main className="min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    );
  },
});

/** Landing on / follows the most recently active session. */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    const { data: board, isPending } = useQuery(boardQuery());
    if (isPending) return <Loading />;
    const newest = board?.sessions[0];
    if (!newest) return <Empty />;
    return <Navigate to="/session/$id/$tab" params={{ id: newest.id, tab: 'features' }} replace />;
  },
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session/$id/$tab',
  component: function Session() {
    const { id, tab } = useParams({ from: '/session/$id/$tab' });
    const { data, isPending } = useQuery(sessionQuery(id));

    if (isPending && !data) return <Loading />;
    if (!data) return <ScreenState title="Unknown session" />;

    return <SessionView session={data} tab={(TABS as readonly string[]).includes(tab) ? (tab as TabName) : 'features'} />;
  },
});

function SessionView({ session, tab }: { session: SessionDetail; tab: TabName }) {
  const navigate = useNavigate();
  const stats = rollup(session.features);
  const counts: Record<TabName, number> = {
    features: session.features.length,
    tasks: stats.total,
    prompts: session.prompts.length,
    git: session.git ? session.git.modified + session.git.untracked : 0,
    decisions: session.decisions.length,
    activity: session.activity?.tools.length ?? 0,
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-16 p-28 max-md:p-20">
      <header className="flex flex-col gap-8">
        <SessionTitle
          id={session.id}
          title={session.title}
          isCustom={session.titleIsCustom}
          fallback={session.project}
        />
        <div className="flex flex-wrap items-center gap-6">
          <Pill
            label={session.live ? 'live' : `idle ${relative(session.at)}`}
            tone={session.live ? 'success' : 'neutral'}
            size="sm"
            icon={undefined}
          />
          <StatusDot state={session.live ? 'active' : 'resting'}
        label={session.live ? 'live' : 'idle'} />
          <Pill label={session.project} tone="neutral" size="sm" />
          {session.worktree ? <Pill label={session.worktree} tone="primary" size="sm" /> : null}
          {session.started ? (
            <Pill
              label={`running ${duration(Math.round((Date.now() - session.started) / 60000))}`}
              tone="neutral"
              size="sm"
            />
          ) : null}
          <Pill
            label={`${session.turns.user} / ${session.turns.assistant} turns`}
            tone="neutral"
            size="sm"
          />
          {session.toolCalls ? (
            <Pill label={`${session.toolCalls} tools`} tone="neutral" size="sm" />
          ) : null}
          {session.subagentCount ? (
            <Pill label={`${session.subagentCount} subagents`} tone="neutral" size="sm" />
          ) : null}
          {session.model ? (
            <Pill label={session.model.replace(/^claude-/, '')} tone="neutral" size="sm" />
          ) : null}
        </div>
        {session.cwd ? (
          <p className="break-all font-mono text-11 text-gray-11">{session.cwd}</p>
        ) : null}

        {/* Session-wide progress sits in the header rather than inside a tab, so it
            stays visible whichever tab is open. */}
        {stats.total > 0 ? (
          <Progress
            className="mt-4"
            value={stats.percent}
            tone={stats.done === stats.total ? 'success' : stats.blocked ? 'warning' : 'primary'}
            size="lg"
            label={`${stats.done}/${stats.total}`}
            trailing={
              stats.estimated
                ? `${duration(stats.spent)} of ${duration(stats.estimated)}`
                : stats.spent
                  ? duration(stats.spent)
                  : undefined
            }
          />
        ) : null}
      </header>

      <Tabs
        label="Session detail"
        value={tab}
        onChange={(next) =>
          navigate({ to: '/session/$id/$tab', params: { id: session.id, tab: next } })
        }
        items={TABS.map((name) => ({
          value: name,
          label: name,
          badge: counts[name] || undefined,
        }))}
      />

      <div className="min-w-0">
        {tab === 'features' ? <FeaturesPanel features={session.features} /> : null}
        {tab === 'tasks' ? <TasksPanel features={session.features} /> : null}
        {tab === 'prompts' ? <PromptsPanel prompts={session.prompts} /> : null}
        {tab === 'git' ? <GitPanel git={session.git} /> : null}
        {tab === 'decisions' ? <DecisionsPanel decisions={session.decisions} /> : null}
        {tab === 'activity' ? <ActivityPanel activity={session.activity} /> : null}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}

function Empty() {
  return (
    <div className="p-32">
      <ScreenState
        title="No sessions yet"
        body="Sessions appear here once Claude Code has run in a project on this machine."
      />
    </div>
  );
}

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, sessionRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
