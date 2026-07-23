import { useEffect, useMemo, useState } from 'react';
import type { ActivityFilters, IssueLevel } from '../../api/signals/signals-api';
import { useSignalsActivity, useSignalsApps } from '../../api/signals/use-signals';
import { cn } from '@tickets/ui/cn';
import { ACTIVITY_GRID_COLUMNS, ActivityRow, ActivityRowSkeleton } from './activity-row';
import { ActivityToolbar } from './activity-toolbar';
import { formatCount } from './format';

const PER_PAGE = 25;
const DEBOUNCE_MS = 300;
const SKELETON_ROWS = 8;

// Builds the same query string signals-api.ts's listSignals would, purely
// for the error state's "failing URL" line — display only, never sent.
// Mirrors issues-screen.tsx's displayUrl.
function displayUrl(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `/signals-api/signals${qs.length > 0 ? `?${qs}` : ''}`;
}

const HEADER_CELLS: { label: string; className?: string }[] = [
  { label: '' },
  { label: '' },
  { label: 'Signal' },
  { label: 'App' },
  { label: 'When' },
  { label: 'Session' },
];

function TableHeader() {
  return (
    <div
      role="row"
      className="grid h-9 shrink-0 items-center border-b border-hairline bg-app px-3.5 font-sans text-label font-medium tracking-wider text-ink-2 uppercase"
      style={{ gridTemplateColumns: ACTIVITY_GRID_COLUMNS }}
    >
      {HEADER_CELLS.map((cell, index) => (
        <span key={index} className={cell.className}>
          {cell.label}
        </span>
      ))}
    </div>
  );
}

// The "Signals" section's Activity screen — a sibling to IssuesScreen that
// browses the raw log/event stream (non-error signals) rather than grouped
// issues. Same toolbar/list/pagination/loading/error/empty patterns as
// issues-screen.tsx, backed by GET /signals-api/signals instead of /issues.
export function ActivityScreen() {
  const [appId, setAppId] = useState<number | undefined>(undefined);
  const [kind, setKind] = useState<'log' | 'event' | undefined>(undefined);
  const [level, setLevel] = useState<IssueLevel | undefined>(undefined);
  const [days, setDays] = useState(14);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box 300ms before it hits the `q` filter (and the
  // network) — typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  // Any filter change invalidates the current page.
  useEffect(() => {
    setPage(1);
  }, [appId, kind, level, days, debouncedQ]);

  const filters: ActivityFilters = useMemo(
    () => ({
      app: appId,
      // No `kind` param means "log,event" (both) per the collector's
      // default — omitted here rather than sent as 'log,event' since the
      // API treats an absent kind as that default already.
      kind,
      level,
      days,
      q: debouncedQ.trim() === '' ? undefined : debouncedQ.trim(),
      page,
      perPage: PER_PAGE,
    }),
    [appId, kind, level, days, debouncedQ, page],
  );

  const activityQuery = useSignalsActivity(filters);
  const appsQuery = useSignalsApps();

  const rows = activityQuery.data?.rows ?? [];
  const total = activityQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const isLoading = activityQuery.isLoading;
  const isError = activityQuery.isError;
  const isEmpty = !isLoading && !isError && rows.length === 0;
  const isList = !isLoading && !isError && !isEmpty;
  const filtersActive =
    appId !== undefined || kind !== undefined || level !== undefined || debouncedQ.trim() !== '';

  return (
    <div className="flex h-full min-h-0 flex-col p-6 md:p-7">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-sans text-[22px] leading-tight font-semibold text-ink">Signals</h1>
        <span className="font-mono text-meta text-ink-3">
          {formatCount(total)} signals last {days}d
        </span>
      </div>

      {/* Nav lives in the Signals sidebar panel — see issues-screen.tsx. */}

      <ActivityToolbar
        apps={appsQuery.data ?? []}
        appId={appId}
        onAppChange={setAppId}
        kind={kind}
        onKindChange={setKind}
        level={level}
        onLevelChange={setLevel}
        days={days}
        onDaysChange={setDays}
        q={q}
        onQChange={setQ}
        dimmed={isLoading || isError}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-hairline bg-raised">
        <TableHeader />

        {isList ? (
          <>
            <div className="flex-1 overflow-auto">
              {rows.map((row) => (
                <ActivityRow key={row.id} signal={row} />
              ))}
            </div>
            <div className="flex h-9.5 shrink-0 items-center gap-2 border-t border-hairline bg-app px-3.5 font-mono text-[11px] text-ink-3">
              <span>{total} signals</span>
              <span className="flex-1" />
              {total > PER_PAGE ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="disabled:pointer-events-none disabled:opacity-40 hover:text-ink"
                  >
                    ‹
                  </button>
                  <span>
                    page {page} of {pageCount}
                  </span>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={page >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    className="disabled:pointer-events-none disabled:opacity-40 hover:text-ink"
                  >
                    ›
                  </button>
                </span>
              ) : null}
            </div>
          </>
        ) : null}

        {isLoading ? (
          <>
            <div className="flex-1 overflow-hidden">
              {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <ActivityRowSkeleton key={index} index={index} />
              ))}
            </div>
            <div className="flex h-9.5 shrink-0 items-center gap-2.5 border-t border-hairline bg-app px-3.5 font-mono text-[11px] text-ink-3">
              <span
                aria-hidden
                className="size-2.75 animate-spin rounded-full border-2 border-hairline border-t-ink-2"
              />
              <span>loading activity…</span>
            </div>
          </>
        ) : null}

        {isError ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex max-w-115 flex-col items-center gap-3.5 text-center">
              <span className="flex size-9.5 items-center justify-center rounded-[10px] bg-danger-subtle font-mono text-[16px] font-semibold text-danger">
                ✕
              </span>
              <div className="font-sans text-[17px] font-semibold text-ink">Couldn't load activity</div>
              <div className="font-mono text-[11.5px] leading-relaxed text-ink-3">{displayUrl(filters)}</div>
              <div className="font-sans text-[12.5px] leading-normal text-ink-2">
                The signals daemon isn't responding. Check that it's running, then try again.
              </div>
              <button
                type="button"
                onClick={() => void activityQuery.refetch()}
                className={cn(
                  'mt-0.5 h-8 rounded-[8px] border border-control bg-raised px-3.25 font-sans text-[12.5px] font-medium text-ink',
                  'hover:bg-inset',
                )}
              >
                ↻ Retry
              </button>
            </div>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex max-w-110 flex-col items-center gap-3.5 text-center">
              <span className="flex size-9.5 items-center justify-center rounded-full bg-kind-done-subtle font-sans text-[16px] font-semibold text-kind-done">
                ✓
              </span>
              <div className="font-sans text-[17px] font-semibold text-ink">
                {filtersActive ? 'No signals match the current filters.' : 'No activity yet'}
              </div>
              <div className="font-sans text-[12.5px] leading-normal text-ink-2">
                Logs and events reported in the last {days} days will show up here as they arrive.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
