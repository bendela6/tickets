import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiError } from '../../api/api-error';
import { usePatchIssueStatus, useSignalsIssue, useSignalsOccurrences, useSignalsSession } from '../../api/signals/use-signals';
import { Button } from '../../ui/button';
import { BreadcrumbList } from './breadcrumb-list';
import { ContextRail } from './context-rail';
import { formatCount, relativeTime } from './format';
import { splitTitle } from './issue-row';
import { LevelDot } from './level-dot';
import { Sparkline } from './sparkline';
import { StackTrace } from './stack-trace';
import { StatusChip } from './status-chip';

const OCCURRENCES_PER_PAGE = 25;
const OCCURRENCES_GRID_COLUMNS = '200px 110px minmax(0,1fr) auto';

function OccurrencesCard({ issueId }: { issueId: number }) {
  const [page, setPage] = useState(1);
  const query = useSignalsOccurrences(issueId, page);
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / OCCURRENCES_PER_PAGE));

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-hairline bg-raised">
      <div className="flex h-10.5 items-center gap-2.5 border-b border-hairline px-4">
        <span className="font-sans text-[13.5px] font-semibold text-ink">Occurrences</span>
        <span className="font-mono text-[11px] text-ink-3">{formatCount(total)} total</span>
      </div>
      <div
        role="row"
        className="grid h-7.5 items-center border-b border-hairline bg-app px-4 font-sans text-[10.5px] font-medium tracking-wide text-ink-2 uppercase"
        style={{ gridTemplateColumns: OCCURRENCES_GRID_COLUMNS }}
      >
        <span>Time</span>
        <span>Release</span>
        <span>Session</span>
        <span />
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">no occurrences recorded</div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            role="row"
            className="grid h-8.5 items-center border-b border-hairline px-4 last:border-b-0"
            style={{ gridTemplateColumns: OCCURRENCES_GRID_COLUMNS }}
          >
            <span className="font-mono text-[11.5px] font-medium text-ink">{relativeTime(row.receivedAt)}</span>
            <span className="font-mono text-[11.5px] text-ink-2">{row.release ?? '—'}</span>
            <span>
              {row.sessionId !== null ? (
                <Link
                  to="/signals/sessions/$sessionId"
                  params={{ sessionId: row.sessionId }}
                  className="font-mono text-[11.5px] font-medium text-accent hover:underline"
                >
                  {row.sessionId} →
                </Link>
              ) : (
                <span className="font-mono text-[11.5px] text-ink-3">—</span>
              )}
            </span>
            <span />
          </div>
        ))
      )}
      <div className="flex h-8.5 items-center gap-2 border-t border-hairline bg-app px-4 font-mono text-[11px] text-ink-3">
        <span>{OCCURRENCES_PER_PAGE} per page</span>
        <span className="flex-1" />
        {total > OCCURRENCES_PER_PAGE ? (
          <>
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
          </>
        ) : null}
      </div>
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
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="font-sans text-[15px] font-semibold text-ink">Issue not found</div>
          <Link to="/signals" className="font-sans text-meta text-accent hover:underline">
            ‹ Back to Issues
          </Link>
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-115 flex-col items-center gap-3.5 text-center">
          <span className="flex size-9.5 items-center justify-center rounded-[10px] bg-danger-subtle font-mono text-[16px] font-semibold text-danger">
            ✕
          </span>
          <div className="font-sans text-[17px] font-semibold text-ink">Couldn't load issue</div>
          <div className="font-sans text-[12.5px] leading-normal text-ink-2">
            The signals daemon isn't responding. Check that it's running, then try again.
          </div>
          <button
            type="button"
            onClick={() => void issueQuery.refetch()}
            className="mt-0.5 h-8 rounded-[8px] border border-control bg-raised px-3.25 font-sans text-[12.5px] font-medium text-ink hover:bg-inset"
          >
            ↻ Retry
          </button>
        </div>
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
      <div className="mb-3 font-mono text-[12px] text-ink-3">
        <Link to="/signals" className="text-accent hover:underline">
          ‹ Issues
        </Link>{' '}
        / {issue.key}
      </div>

      <div className="mb-3 flex items-start gap-3">
        <LevelDot level={issue.level} className="mt-2" />
        <div className="min-w-0 flex-1">
          <div className="font-sans text-[18px] leading-tight font-semibold text-ink">
            <span className="font-mono text-[17px]">{name}</span>
            {message !== null ? (
              <span className="ml-2 font-sans text-[16px] font-normal text-ink-2">— {message}</span>
            ) : null}
          </div>
          <div className="mt-1.75 flex items-center gap-2">
            <StatusChip status={issue.status} />
            <span className="inline-flex h-5.5 items-center rounded-md bg-inset px-2 font-mono text-[11px] font-medium text-ink-2">
              {issue.appSlug}
            </span>
            <span className="font-mono text-[11px] text-ink-3">
              {issue.culprit !== null ? `${issue.key} · ${issue.culprit}` : issue.key}
            </span>
          </div>
        </div>
        <Button variant="secondary" onClick={() => patchStatus.mutate({ id: issue.id, status: 'resolved' })}>
          ✓ Resolve
        </Button>
        <Button variant="secondary" onClick={() => patchStatus.mutate({ id: issue.id, status: 'ignored' })}>
          ⊘ Ignore
        </Button>
      </div>

      <div className="mb-4 flex flex-none items-center gap-6.5 rounded-[10px] border border-hairline bg-raised px-4.5 py-3">
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">EVENTS</div>
          <div className="font-mono text-[14px] font-semibold text-ink">{formatCount(issue.eventCount)}</div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">SESSIONS</div>
          <div className="font-mono text-[14px] font-medium text-ink">{formatCount(issue.sessionCount)}</div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">FIRST SEEN</div>
          <div className="font-sans text-[13px] text-ink">
            {relativeTime(issue.firstSeen)} ago
            {issue.releaseRange.first !== null ? (
              <span className="ml-1.5 font-mono text-[11px] text-ink-3">· {issue.releaseRange.first}</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">LAST SEEN</div>
          <div className="font-sans text-[13px] font-medium text-ink">
            {relativeTime(issue.lastSeen)} ago
            {issue.releaseRange.last !== null ? (
              <span className="ml-1.5 font-mono text-[11px] font-normal text-ink-3">· {issue.releaseRange.last}</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">RELEASES</div>
          <div className="font-mono text-[12px] text-ink">
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
          <BreadcrumbList breadcrumbs={payload?.breadcrumbs} sessionId={newestOccurrence?.sessionId ?? undefined} />
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
