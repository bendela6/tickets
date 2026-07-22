import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiError } from '../../api/api-error';
import type { PlatformInfo, SessionEventRow, SignalPayload } from '../../api/signals/signals-api';
import { useSignalsSession } from '../../api/signals/use-signals';
import { cn } from '../../ui/cn';
import { formatClockTime, formatCount, formatDurationMs } from './format';
import type { SignalKind } from './kind-glyph';
import { KindGlyph } from './kind-glyph';

const COPY_STATE_RESET_MS = 1500;
const IDLE_GAP_THRESHOLD_MS = 30_000;

// The session `kind` column only ever holds these three values (see
// apps/signals/src/types.ts) — a bare cast would let anything through, so
// unrecognized values fall back to KindGlyph's neutral "custom" badge rather
// than crashing.
function toSignalKind(kind: string): SignalKind {
  return kind === 'event' || kind === 'log' || kind === 'error' ? kind : 'custom';
}

function kindLabel(kind: string): string {
  return kind === 'log' ? 'console' : kind;
}

// Events carry a short `name` plus an optional detail `message`
// ("cart_updated" + "3 items, $83.40" -> "cart_updated — 3 items, $83.40");
// logs just show whatever text landed in `message` (falling back to `name`
// for the rare log row that never got one).
function rowMessage(row: SessionEventRow): string {
  if (row.kind === 'log') {
    return row.message ?? row.name ?? '';
  }
  if (row.name !== null && row.message !== null && row.message !== '') {
    return `${row.name} — ${row.message}`;
  }
  return row.name ?? row.message ?? '';
}

function errorCulprit(payload: SignalPayload, mechanism: string | null): string | undefined {
  const frame = payload.stackSymbolicated?.[0] ?? payload.stack?.[0];
  const parts: string[] = [];
  if (frame !== undefined) {
    parts.push(`${frame.file}:${frame.line}`);
  }
  if (mechanism !== null) {
    parts.push(mechanism);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function formatPlatform(platform: PlatformInfo | null): string {
  if (platform === null) {
    return '—';
  }
  const browserParts = [platform.browser, platform.os].filter((p): p is string => p !== undefined);
  if (browserParts.length > 0) {
    return browserParts.join(' · ');
  }
  const nodeParts = [platform.nodeVersion, platform.hostname].filter((p): p is string => p !== undefined);
  if (nodeParts.length > 0) {
    return nodeParts.join(' · ');
  }
  return platform.runtime;
}

function headerUser(user: Record<string, unknown> | undefined): { label: string; initials: string } | undefined {
  const id = typeof user?.id === 'string' ? user.id : undefined;
  const email = typeof user?.email === 'string' ? user.email : undefined;
  const label = id ?? email;
  if (label === undefined) {
    return undefined;
  }
  return { label, initials: label.slice(0, 2).toUpperCase() };
}

// One entry in the rendered timeline: either a real signal row, or a
// compressed idle-gap pill inserted between two rows whose clientTimestamps
// are more than IDLE_GAP_THRESHOLD_MS apart.
type TimelineItem = { type: 'row'; key: string; row: SessionEventRow } | { type: 'gap'; key: string; seconds: number };

function buildTimeline(rows: SessionEventRow[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let prevMs: number | null = null;
  for (const row of rows) {
    const ms = new Date(row.clientTimestamp).getTime();
    if (prevMs !== null) {
      const diffMs = ms - prevMs;
      if (diffMs > IDLE_GAP_THRESHOLD_MS) {
        items.push({ type: 'gap', key: `gap-${row.id}`, seconds: Math.round(diffMs / 1000) });
      }
    }
    items.push({ type: 'row', key: String(row.id), row });
    prevMs = ms;
  }
  return items;
}

function elapsedLabel(clientTimestamp: string, startedAt: string): string {
  const seconds = (new Date(clientTimestamp).getTime() - new Date(startedAt).getTime()) / 1000;
  return `t+${seconds.toFixed(1)}s`;
}

function CopySessionIdButton({ sessionId }: { sessionId: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (copyState === 'idle') {
      return;
    }
    const timer = window.setTimeout(() => setCopyState('idle'), COPY_STATE_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="h-8 flex-none rounded-[8px] border border-control bg-raised px-3.25 font-sans text-[12.5px] font-medium text-ink hover:border-ink-3 hover:bg-inset"
    >
      {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : '⧉ Copy session id'}
    </button>
  );
}

function ErrorCard({ row }: { row: SessionEventRow }) {
  const culprit = errorCulprit(row.payload, row.mechanism);
  return (
    <div className="rounded-[10px] border border-danger bg-danger-subtle px-3.5 py-2.75">
      <div className="flex items-center gap-2.5">
        <span className="flex-none font-mono text-[13px] font-semibold text-danger">{row.name}</span>
        <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-ink">{row.message}</span>
        {row.issueId !== null && row.issueKey !== null ? (
          <Link
            to="/signals/issues/$issueId"
            params={{ issueId: String(row.issueId) }}
            className="inline-flex h-6.5 flex-none items-center rounded-[6px] border border-danger px-2.5 font-sans text-[11px] font-medium text-danger hover:bg-danger/10"
          >
            View issue {row.issueKey} →
          </Link>
        ) : null}
      </div>
      {culprit !== undefined ? <div className="mt-1.25 font-mono text-[11px] text-ink-2">{culprit}</div> : null}
    </div>
  );
}

function TimelineRow({ item, startedAt, isFirst, isLast }: { item: TimelineItem; startedAt: string; isFirst: boolean; isLast: boolean }) {
  const lineClass = 'w-[1.5px] flex-none bg-hairline';
  return (
    <div className="flex items-stretch">
      <span className="flex w-16 flex-none justify-end pt-0.5 font-mono text-[11px] text-ink-3">
        {item.type === 'row' ? elapsedLabel(item.row.clientTimestamp, startedAt) : null}
      </span>
      <span className="flex w-11 flex-none flex-col items-center">
        <span className={cn(lineClass, 'h-2', isFirst && 'bg-transparent')} />
        {item.type === 'row' ? (
          <KindGlyph type={toSignalKind(item.row.kind)} />
        ) : (
          <span className="py-0.5 font-mono text-[10px] text-ink-3">┆</span>
        )}
        <span className={cn(lineClass, 'flex-1', isLast && 'bg-transparent')} />
      </span>
      <span className="min-w-0 flex-1 py-0.5 pb-2.5 pl-3">
        {item.type === 'gap' ? (
          <span className="inline-flex h-5.5 items-center rounded-full border border-dashed border-control px-2.25 font-mono text-[10.5px] text-ink-3">
            {item.seconds}s idle
          </span>
        ) : item.row.kind === 'error' ? (
          <ErrorCard row={item.row} />
        ) : (
          <span className="flex min-h-5.5 items-center gap-2.25">
            <span className="w-18.5 flex-none font-mono text-[10.5px] text-ink-3">{kindLabel(item.row.kind)}</span>
            <span
              className={cn(
                'truncate',
                item.row.kind === 'event'
                  ? 'font-sans text-[12.5px] text-ink'
                  : 'font-mono text-[12px] text-ink',
              )}
            >
              {rowMessage(item.row)}
            </span>
          </span>
        )}
      </span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-sans text-[15px] font-semibold text-ink">Session not found</div>
      <Link to="/signals" className="font-sans text-meta text-accent hover:underline">
        ‹ Back to Issues
      </Link>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-115 flex-col items-center gap-3.5 text-center">
        <span className="flex size-9.5 items-center justify-center rounded-[10px] bg-danger-subtle font-mono text-[16px] font-semibold text-danger">
          ✕
        </span>
        <div className="font-sans text-[17px] font-semibold text-ink">Couldn't load session</div>
        <div className="font-sans text-[12.5px] leading-normal text-ink-2">
          The signals daemon isn't responding. Check that it's running, then try again.
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-0.5 h-8 rounded-[8px] border border-control bg-raised px-3.25 font-sans text-[12.5px] font-medium text-ink hover:bg-inset"
        >
          ↻ Retry
        </button>
      </div>
    </div>
  );
}

/**
 * Session timeline screen (docs/design/SigSession.dc.html): one page load,
 * everything it reported, in order — vertical-line timeline with an elapsed
 * (t+X.Xs) gutter, idle-gap compression, and a terminal danger card for the
 * error that ends the session (if any). Mirrors the issue-detail screen's
 * 404-vs-error convention: an ApiError with status 404 reads as "this
 * session doesn't exist"; anything else is a transient/recoverable failure.
 */
export function SessionScreen({ sessionId }: { sessionId: string }) {
  const sessionQuery = useSignalsSession(sessionId);

  if (sessionQuery.isLoading) {
    return null;
  }

  if (sessionQuery.isError) {
    const notFound = sessionQuery.error instanceof ApiError && sessionQuery.error.status === 404;
    return notFound ? <NotFound /> : <LoadError onRetry={() => void sessionQuery.refetch()} />;
  }

  if (sessionQuery.data === undefined) {
    return null;
  }

  const { session, rows } = sessionQuery.data;
  const errorRow = rows.find((row) => row.kind === 'error' && row.issueKey !== null);
  const user = headerUser(rows[0]?.payload.user);
  const total = session.counts.error + session.counts.log + session.counts.event;
  const timeline = buildTimeline(rows);

  return (
    <div className="flex h-full min-h-0 flex-col p-6 md:p-7">
      <div className="mb-3 font-mono text-[12px] text-ink-3">
        <Link to="/signals" className="text-accent hover:underline">
          ‹ Issues
        </Link>
        {errorRow !== undefined ? (
          <>
            {' '}
            /{' '}
            <Link
              to="/signals/issues/$issueId"
              params={{ issueId: String(errorRow.issueId) }}
              className="text-accent hover:underline"
            >
              {errorRow.issueKey}
            </Link>{' '}
            / session
          </>
        ) : null}
      </div>

      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[18px] font-semibold text-ink">{session.sessionId}</span>
            <span className="inline-flex h-5.5 items-center rounded-md bg-inset px-2 font-mono text-[11px] font-medium text-ink-2">
              app {session.appId}
            </span>
            {user !== undefined ? (
              <span className="inline-flex items-center gap-1.5 font-sans text-[12px] text-ink-2">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-accent-subtle font-sans text-[8px] font-semibold text-accent">
                  {user.initials}
                </span>
                {user.label}
              </span>
            ) : null}
            {session.crashed ? (
              <span className="inline-flex h-5.5 items-center gap-1.5 rounded-md bg-danger-subtle px-2 font-sans text-[11px] font-semibold text-danger">
                <span className="size-1.75 shrink-0 rounded-full bg-danger" />
                crashed
              </span>
            ) : null}
          </div>
        </div>
        <CopySessionIdButton sessionId={session.sessionId} />
      </div>

      <div className="mb-4 flex flex-none items-center gap-6.5 rounded-[10px] border border-hairline bg-raised px-4.5 py-3">
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">STARTED</div>
          <div className="font-mono text-[13px] font-medium text-ink">{formatClockTime(session.startedAt)}</div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">DURATION</div>
          <div className="font-mono text-[13px] font-medium text-ink">
            {session.durationMs !== null ? formatDurationMs(session.durationMs) : '—'}
          </div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">SIGNALS</div>
          <div className="font-sans text-[13px] text-ink">
            <span className="font-mono text-[13px] font-medium">{formatCount(total)}</span>{' '}
            <span className="font-mono text-[11px] text-ink-3">
              · {formatCount(session.counts.log)} logs · {formatCount(session.counts.event)} events ·{' '}
              {formatCount(session.counts.error)} error
            </span>
          </div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">RELEASE</div>
          <div className="font-mono text-[13px] text-ink">{session.release ?? '—'}</div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">BROWSER</div>
          <div className="font-sans text-[13px] text-ink">{formatPlatform(session.platform)}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-hairline bg-raised p-4 md:p-5">
        <div className="flex max-w-245 flex-col">
          {timeline.map((item, index) => (
            <TimelineRow
              key={item.key}
              item={item}
              startedAt={session.startedAt}
              isFirst={index === 0}
              isLast={index === timeline.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
