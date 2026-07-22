import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { IssueFilters, IssueLevel, IssueStatus } from '../../api/signals/signals-api';
import { usePatchIssueStatus, useSignalsApps, useSignalsIssues } from '../../api/signals/use-signals';
import { cn } from '../../ui/cn';
import { formatCount } from './format';
import { ISSUES_GRID_COLUMNS, IssueRow, IssueRowSkeleton } from './issue-row';
import { IssuesToolbar } from './issues-toolbar';

const PER_PAGE = 25;
const DEBOUNCE_MS = 300;
const SKELETON_ROWS = 8;

// Builds the same query string signals-api.ts's listIssues would, purely for
// the error state's "failing URL" line — display only, never sent.
function displayUrl(filters: IssueFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `/signals-api/issues${qs.length > 0 ? `?${qs}` : ''}`;
}

// Per-column classes mirroring each column's data-cell padding (design lines
// 59 vs. 72-79: First gets pl-3.5/14px, 14 days gets pl-1.5/6px, Status gets
// pl-1/4px) so header labels line up with the cells beneath them.
const HEADER_CELLS: { label: string; className?: string }[] = [
  { label: '' },
  { label: 'Issue' },
  { label: 'App' },
  { label: 'Events', className: 'text-right' },
  { label: 'First', className: 'pl-3.5' },
  { label: 'Last' },
  { label: '14 days', className: 'pl-1.5' },
  { label: 'Status', className: 'pl-1' },
  { label: '' },
];

function TableHeader() {
  return (
    <div
      role="row"
      className="grid h-9 shrink-0 items-center border-b border-hairline bg-app px-3.5 font-sans text-label font-medium tracking-wider text-ink-2 uppercase"
      style={{ gridTemplateColumns: ISSUES_GRID_COLUMNS }}
    >
      {HEADER_CELLS.map((cell, index) => (
        <span key={index} className={cell.className}>
          {cell.label}
        </span>
      ))}
    </div>
  );
}

// The "Signals" section's Issues screen — the workhorse view: filterable,
// sortable-by-status issue table with sparklines and inline resolve/ignore
// actions. Per docs/design/SigIssues.dc.html, which defines the grid, the
// toolbar, and all four states (list/loading/error/empty).
export function IssuesScreen() {
  const navigate = useNavigate();

  const [appId, setAppId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<IssueStatus>('open');
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
  }, [appId, status, level, days, debouncedQ]);

  const filters: IssueFilters = useMemo(
    () => ({
      app: appId,
      status,
      level,
      days,
      q: debouncedQ.trim() === '' ? undefined : debouncedQ.trim(),
      page,
      perPage: PER_PAGE,
    }),
    [appId, status, level, days, debouncedQ, page],
  );

  const issuesQuery = useSignalsIssues(filters);
  const appsQuery = useSignalsApps();
  // Segmented-control counts: one extra perPage:1 query per status (cheap —
  // the API doesn't expose a combined counts endpoint). These reuse every
  // other active filter (app/level/days/q) so the counts — and the header's
  // "N open issues" — reflect the current filter context, not the global
  // total.
  const openCount = useSignalsIssues({ ...filters, status: 'open', page: undefined, perPage: 1 });
  const resolvedCount = useSignalsIssues({ ...filters, status: 'resolved', page: undefined, perPage: 1 });
  const ignoredCount = useSignalsIssues({ ...filters, status: 'ignored', page: undefined, perPage: 1 });
  const patchStatus = usePatchIssueStatus();

  const rows = issuesQuery.data?.rows ?? [];
  const total = issuesQuery.data?.total ?? 0;
  const loadedEvents = rows.reduce((sum, row) => sum + row.eventCount, 0);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const isLoading = issuesQuery.isLoading;
  const isError = issuesQuery.isError;
  const isEmpty = !isLoading && !isError && rows.length === 0;
  const isList = !isLoading && !isError && !isEmpty;
  // "No open issues 🎉" only reads as an all-clear when the list is
  // unfiltered — days/status aside, an active q/level/app filter means the
  // empty result might just be a filter with nothing matching it.
  const filtersActive = appId !== undefined || level !== undefined || debouncedQ.trim() !== '';

  return (
    <div className="flex h-full min-h-0 flex-col p-6 md:p-7">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-sans text-[22px] leading-tight font-semibold text-ink">Signals</h1>
        <span className="font-mono text-meta text-ink-3">
          {openCount.data?.total ?? 0} open issues · {formatCount(loadedEvents)} events last {days}d
        </span>
      </div>

      <div className="mb-3.5 flex shrink-0 items-center gap-1.5 border-b border-hairline">
        <span className="-mb-px flex items-center gap-1.75 border-b-2 border-accent px-3 py-2 font-sans text-ui font-medium text-ink">
          Issues
          <span className="font-mono text-[11px] text-ink-3">{total}</span>
        </span>
        <Link
          to="/signals/apps"
          className="-mb-px flex items-center gap-1.75 border-b-2 border-transparent px-3 py-2 font-sans text-ui text-ink-2 hover:text-ink"
        >
          Apps
          <span className="font-mono text-[11px] text-ink-3">{appsQuery.data?.length ?? ''}</span>
        </Link>
      </div>

      <IssuesToolbar
        apps={appsQuery.data ?? []}
        appId={appId}
        onAppChange={setAppId}
        status={status}
        onStatusChange={setStatus}
        statusCounts={{
          open: openCount.data?.total,
          resolved: resolvedCount.data?.total,
          ignored: ignoredCount.data?.total,
        }}
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
              {rows.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  onOpen={() =>
                    void navigate({ to: '/signals/issues/$issueId', params: { issueId: String(issue.id) } })
                  }
                  onResolve={() => patchStatus.mutate({ id: issue.id, status: 'resolved' })}
                  onIgnore={() => patchStatus.mutate({ id: issue.id, status: 'ignored' })}
                />
              ))}
            </div>
            <div className="flex h-9.5 shrink-0 items-center gap-2 border-t border-hairline bg-app px-3.5 font-mono text-[11px] text-ink-3">
              <span>{total} issues</span>
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
                <IssueRowSkeleton key={index} index={index} />
              ))}
            </div>
            <div className="flex h-9.5 shrink-0 items-center gap-2.5 border-t border-hairline bg-app px-3.5 font-mono text-[11px] text-ink-3">
              <span
                aria-hidden
                className="size-2.75 animate-spin rounded-full border-2 border-hairline border-t-ink-2"
              />
              <span>loading issues…</span>
            </div>
          </>
        ) : null}

        {isError ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex max-w-115 flex-col items-center gap-3.5 text-center">
              <span className="flex size-9.5 items-center justify-center rounded-[10px] bg-danger-subtle font-mono text-[16px] font-semibold text-danger">
                ✕
              </span>
              <div className="font-sans text-[17px] font-semibold text-ink">Couldn't load issues</div>
              <div className="font-mono text-[11.5px] leading-relaxed text-ink-3">{displayUrl(filters)}</div>
              <div className="font-sans text-[12.5px] leading-normal text-ink-2">
                The signals daemon isn't responding. Check that it's running, then try again.
              </div>
              <button
                type="button"
                onClick={() => void issuesQuery.refetch()}
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
                {filtersActive
                  ? 'No issues match the current filters.'
                  : status === 'open'
                    ? 'No open issues 🎉'
                    : `No ${status} issues`}
              </div>
              <div className="font-sans text-[12.5px] leading-normal text-ink-2">
                Everything reported in the last {days} days is resolved or ignored. New errors will open
                issues here automatically.
              </div>
              <span className="font-mono text-meta text-ink-3">
                view{' '}
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => setStatus('resolved')}
                >
                  resolved ({resolvedCount.data?.total ?? 0})
                </button>{' '}
                ·{' '}
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => setStatus('ignored')}
                >
                  ignored ({ignoredCount.data?.total ?? 0})
                </button>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
