import { Link, useMatchRoute } from '@tanstack/react-router';
import { useSignalsIssues } from '../../api/signals/use-signals';
import { cn } from '../../ui/cn';

function navItemClasses(active: boolean) {
  return cn(
    'flex h-8 items-center gap-2 rounded-[7px] px-2.25 font-sans text-ui',
    active ? 'bg-inset font-medium text-ink' : 'text-ink-2 hover:bg-inset hover:text-ink',
  );
}

// The "signals" mode panel: Issues / Apps nav with the open-issues count.
// Mirrors TerminalsPanel/AgentsPanel's structure — a mono section label up
// top, then the mode's content below.
export function SignalsPanel({ onNavigate }: { onNavigate?: () => void } = {}) {
  const matchRoute = useMatchRoute();
  const openIssues = useSignalsIssues({ status: 'open', perPage: 1 });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">SIGNALS</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        <Link
          to="/signals"
          onClick={onNavigate}
          className={navItemClasses(Boolean(matchRoute({ to: '/signals' })))}
        >
          <span className="flex-1">Issues</span>
          {/* Render nothing while loading so the count never flickers 0 → real value. */}
          {!openIssues.isLoading ? (
            <span className="font-mono text-[11px] text-ink-3">{openIssues.data?.total ?? ''}</span>
          ) : null}
        </Link>
        <Link
          to="/signals/apps"
          onClick={onNavigate}
          className={navItemClasses(Boolean(matchRoute({ to: '/signals/apps' })))}
        >
          <span className="flex-1">Apps</span>
        </Link>
        <Link
          to="/signals/activity"
          onClick={onNavigate}
          className={navItemClasses(Boolean(matchRoute({ to: '/signals/activity' })))}
        >
          <span className="flex-1">Activity</span>
        </Link>
      </nav>
    </div>
  );
}
