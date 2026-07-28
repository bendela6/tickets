import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiError } from '../../api/api-error';
import { usePatchIssueStatus, useSignalsIssue, useSignalsOccurrences, useSignalsSession } from '../../api/signals/use-signals';
import { signalStatus } from '../../domain/signal-status';
import { Button, cn, Pill, ScreenState } from '@tickets/ui';
import type { TerminalBreadcrumb } from './breadcrumb-list';
import { BreadcrumbList } from './breadcrumb-list';
import { ContextRail } from './context-rail';
import { formatCount, relativeTime } from './format';
import { splitTitle } from './issue-row';
import { LevelDot } from './level-dot';
import { Sparkline } from './sparkline';
import { StackTrace } from './stack-trace';

const OCCURRENCES_PER_PAGE = 25;
const OCCURRENCES_GRID_COLUMNS = '200px 110px minmax(0,1fr) auto';

function OccurrencesCard({ issueId }: { issueId: number }) {
  const [page, setPage] = useState(1);
  const query = useSignalsOccurrences(issueId, page);
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / OCCURRENCES_PER_PAGE));

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-gray-6 bg-surface-raised">
      <div className="flex h-10.5 items-center gap-2.5 border-b border-gray-6 px-4">
        <span className="font-sans text-[13.5px] font-600 text-gray-12">Occurrences</span>
        <span className="font-mono text-11 text-gray-9">{formatCount(total)} total</span>
      </div>
      <div
        role="row"
        className="grid h-7.5 items-center border-b border-gray-6 bg-gray-1 px-4 font-sans text-[10.5px] font-500 tracking-wide text-gray-11 uppercase"
        style={{ gridTemplateColumns: OCCURRENCES_GRID_COLUMNS }}
      >
        <span>Time</span>
        <span>Release</span>
        <span>Session</span>
        <span />
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-gray-9">no occurrences recorded</div>
      ) : (
        rows.map((row, index) => {
          // The stack trace + breadcrumbs cards above are built from the newest
          // occurrence (page 1, row 0), so mark that row here — accent tint +
          // a "shown above" note — per the design, so it's clear which one the
          // detail above corresponds to.
          const isNewest = page === 1 && index === 0;
          return (
            <div
              key={row.id}
              role="row"
              className={cn(
                'grid h-8.5 items-center border-b border-gray-6 px-4 last:border-b-0',
                isNewest && 'bg-indigo-3',
              )}
              style={{ gridTemplateColumns: OCCURRENCES_GRID_COLUMNS }}
            >
              <span className="font-mono text-[11.5px] font-500 text-gray-12">{relativeTime(row.receivedAt)}</span>
              <span className="font-mono text-[11.5px] text-gray-11">{row.release ?? '—'}</span>
              <span>
                {row.sessionId !== null ? (
                  <Link
                    to="/signals/sessions/$sessionId"
                    params={{ sessionId: row.sessionId }}
                    className="font-mono text-[11.5px] font-500 text-indigo-9 hover:underline"
                  >
                    {row.sessionId} →
                  </Link>
                ) : (
                  <span className="font-mono text-[11.5px] text-gray-9">—</span>
                )}
              </span>
              <span className="text-right font-mono text-[10.5px] text-gray-9">
                {isNewest ? 'shown above' : ''}
              </span>
            </div>
          );
        })
      )}
      <div className="flex h-8.5 items-center gap-2 border-t border-gray-6 bg-gray-1 px-4 font-mono text-11 text-gray-9">
        <span>{OCCURRENCES_PER_PAGE} per page</span>
        <span className="flex-1" />
        {total > OCCURRENCES_PER_PAGE ? (
          <>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="disabled:pointer-events-none disabled:opacity-40 hover:text-gray-12"
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
              className="disabled:pointer-events-none disabled:opacity-40 hover:text-gray-12"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function IssueNotFound() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <ScreenState
        title="Issue not found"
        action={
          <Link to="/signals" className="font-sans text-meta text-indigo-9 hover:underline">
            ‹ Back to Issues
          </Link>
        }
      />
    </div>
  );
}

/**
 * Issue detail screen (docs/design/SigIssueDetail.dc.html, variants
 * sym/raw) — the densest Signals screen: header + stats bar, stack trace,
 * breadcrumbs, occurrences table, and a context rail (user/tags/platform/
 * context), all sourced from the issue plus the newest occurrence's session
 * payload (listOccurrences(id,1) -> newest sessionId -> getSession ->
 * matching row, per the task brief's 2-request wiring).
 */
export function IssueDetailScreen({ issueId }: { issueId: number }) {
  // The route param comes through as `Number($issueId)` — a non-numeric
  // segment (e.g. "/signals/issues/abc") produces NaN. That's never a real
  // issue id, so it reads as "not found" without ever hitting the network
  // (the queries below disable themselves on an invalid id).
  const validId = Number.isFinite(issueId);

  const issueQuery = useSignalsIssue(issueId);
  const patchStatus = usePatchIssueStatus();

  // Page 1 of occurrences doubles as "the newest occurrence" — its rows[0]
  // feeds the stack trace/breadcrumbs cards. OccurrencesCard below fetches
  // its own page independently for pagination; when it's on page 1 too,
  // react-query dedups the two identical queries into a single request.
  const latestOccurrenceQuery = useSignalsOccurrences(issueId, 1);
  const newestOccurrence = latestOccurrenceQuery.data?.rows[0];
  const sessionQuery = useSignalsSession(newestOccurrence?.sessionId ?? '');

  const matchedRow =
    sessionQuery.data?.rows.find((row) => row.id === newestOccurrence?.id && row.issueId === issueId) ??
    sessionQuery.data?.rows.find((row) => row.issueId === issueId);
  const payload = matchedRow?.payload;

  // The breadcrumbs card's terminal row IS the matched error signal — there
  // is no wire-legal 'error' breadcrumb type to infer it from (see
  // breadcrumb-list.tsx's kindForType comment).
  const terminal: TerminalBreadcrumb | undefined =
    matchedRow !== undefined && matchedRow.name !== null
      ? { name: matchedRow.name, message: matchedRow.message, clientTimestamp: matchedRow.clientTimestamp }
      : undefined;

  if (!validId) {
    return <IssueNotFound />;
  }

  if (issueQuery.isLoading) {
    return null;
  }

  if (issueQuery.isError) {
    // 404 reads as "this issue doesn't exist" — anything else (network
    // down, 500, etc.) is transient and gets the same recoverable
    // "Couldn't load" + Retry treatment as the Issues/Apps list screens,
    // not a false "not found".
    const notFound = issueQuery.error instanceof ApiError && issueQuery.error.status === 404;

    if (notFound) {
      return <IssueNotFound />;
    }

    return (
      <div className="flex h-full items-center justify-center p-6">
        <ScreenState
          className="max-w-115"
          tone="danger"
          icon="triangle-alert"
          title="Couldn't load issue"
          body="The signals daemon isn't responding. Check that it's running, then try again."
          action={
            <button
              type="button"
              onClick={() => void issueQuery.refetch()}
              className="h-8 rounded-[8px] border border-gray-7 bg-surface-raised px-3.25 font-sans text-[12.5px] font-500 text-gray-12 hover:bg-surface-inset"
            >
              ↻ Retry
            </button>
          }
        />
      </div>
    );
  }

  if (issueQuery.data === undefined) {
    return null;
  }

  const issue = issueQuery.data;
  const { name, message } = splitTitle(issue.title);
  const hot = issue.status === 'open' && (issue.spark[issue.spark.length - 1] ?? 0) > 0;

  return (
    <div className="flex h-full min-h-0 flex-col p-6 md:p-7">
      <div className="mb-3 font-mono text-12 text-gray-9">
        <Link to="/signals" className="text-indigo-9 hover:underline">
          ‹ Issues
        </Link>{' '}
        / {issue.key}
      </div>

      <div className="mb-3 flex items-start gap-3">
        <LevelDot level={issue.level} className="mt-2" />
        <div className="min-w-0 flex-1">
          <div className="font-sans text-[18px] leading-tight font-600 text-gray-12">
            <span className="font-mono text-[17px]">{name}</span>
            {message !== null ? (
              <span className="ml-2 font-sans text-16 font-400 text-gray-11">— {message}</span>
            ) : null}
          </div>
          <div className="mt-1.75 flex items-center gap-2">
            <Pill {...signalStatus(issue.status)} />
            <span className="inline-flex h-5.5 items-center rounded-md bg-surface-inset px-2 font-mono text-11 font-500 text-gray-11">
              {issue.appSlug}
            </span>
            <span className="font-mono text-11 text-gray-9">
              {issue.culprit !== null ? `${issue.key} · ${issue.culprit}` : issue.key}
            </span>
          </div>
        </div>
        {/* Only the transitions that make sense from the current status, so
        every state shows exactly two actions and every state is escapable —
        a resolved or ignored issue can always be reopened. */}
        {issue.status !== 'open' ? (
          <Button variant="outline" onClick={() => patchStatus.mutate({ id: issue.id, status: 'open' })}>
            ↺ Reopen
          </Button>
        ) : null}
        {issue.status !== 'resolved' ? (
          <Button variant="outline" onClick={() => patchStatus.mutate({ id: issue.id, status: 'resolved' })}>
            ✓ Resolve
          </Button>
        ) : null}
        {issue.status !== 'ignored' ? (
          <Button variant="outline" onClick={() => patchStatus.mutate({ id: issue.id, status: 'ignored' })}>
            ⊘ Ignore
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-none items-center gap-6.5 rounded-[10px] border border-gray-6 bg-surface-raised px-4.5 py-3">
        <div>
          <div className="mb-0.75 font-mono text-10 font-500 tracking-wide text-gray-9">EVENTS</div>
          <div className="font-mono text-14 font-600 text-gray-12">{formatCount(issue.eventCount)}</div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-10 font-500 tracking-wide text-gray-9">SESSIONS</div>
          <div className="font-mono text-14 font-500 text-gray-12">{formatCount(issue.sessionCount)}</div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-10 font-500 tracking-wide text-gray-9">FIRST SEEN</div>
          <div className="font-sans text-13 text-gray-12">
            {relativeTime(issue.firstSeen)} ago
            {issue.releaseRange.first !== null ? (
              <span className="ml-1.5 font-mono text-11 text-gray-9">· {issue.releaseRange.first}</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-10 font-500 tracking-wide text-gray-9">LAST SEEN</div>
          <div className="font-sans text-13 font-500 text-gray-12">
            {relativeTime(issue.lastSeen)} ago
            {issue.releaseRange.last !== null ? (
              <span className="ml-1.5 font-mono text-11 font-400 text-gray-9">· {issue.releaseRange.last}</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-10 font-500 tracking-wide text-gray-9">RELEASES</div>
          <div className="font-mono text-12 text-gray-12">
            {issue.releaseRange.first ?? '—'} → {issue.releaseRange.last ?? '—'}
          </div>
        </div>
        <span className="flex-1" />
        <Sparkline counts={issue.spark} hot={hot} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px] gap-4.5 overflow-hidden">
        <div className="flex flex-col gap-4 overflow-auto pr-0.5">
          <StackTrace
            payload={payload}
            release={sessionQuery.data?.session.release}
            occurrenceTime={matchedRow?.clientTimestamp ?? newestOccurrence?.receivedAt}
          />
          <BreadcrumbList
            breadcrumbs={payload?.breadcrumbs}
            terminal={terminal}
            sessionId={newestOccurrence?.sessionId ?? undefined}
          />
          {/* key={issueId} resets the card's internal page state when the
          user navigates from one issue's detail screen straight to
          another's — otherwise a page-3 selection would silently leak into
          the next issue's (usually much shorter) occurrences list. */}
          <OccurrencesCard key={issueId} issueId={issueId} />
        </div>
        <ContextRail issue={issue} payload={payload} />
      </div>
    </div>
  );
}
