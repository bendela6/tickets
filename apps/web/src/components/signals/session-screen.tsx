import { Link } from '@tanstack/react-router';
import { ApiError } from '../../api/api-error';
import type { PlatformInfo, SessionEventRow, SignalPayload, SignalStackFrame } from '../../api/signals/signals-api';
import { useSignalsSession } from '../../api/signals/use-signals';
import { cn, Icon, Pill, ScreenState, useCopy } from '@tickets/ui';
import { signalKindIcon, signalKindTone, type SignalKind } from '../../domain/signal-status';
import { formatClockTime, formatCount, formatDurationMs } from './format';
const IDLE_GAP_THRESHOLD_MS = 30_000;

// The session `kind` column only ever holds these three values (see
// apps/signals/src/types.ts) — a bare cast would let anything through, so
// unrecognized values fall back to the neutral "custom" badge rather than
// crashing.
function toSignalKind(kind: string): SignalKind {
  return kind === 'event' || kind === 'log' || kind === 'error' ? kind : 'custom';
}

function kindLabel(kind: string): string {
  return kind === 'log' ? 'console' : kind;
}

// "3 logs" / "1 error" — the count reads wrong unpluralized (the design's
// "1 error" only looks right by luck).
function plural(n: number, word: string): string {
  return `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`;
}

// STARTED shows a relative-day prefix like the design's "today 14:02:11" so a
// bare clock time isn't ambiguous about which day it was.
function formatStartedAt(iso: string): string {
  const clock = formatClockTime(iso);
  const started = new Date(iso);
  const now = new Date();
  const dayMs = 86_400_000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfStartedDay = new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime();
  const daysAgo = Math.round((startOfToday - startOfStartedDay) / dayMs);
  if (daysAgo === 0) return `today ${clock}`;
  if (daysAgo === 1) return `yesterday ${clock}`;
  return `${started.toLocaleDateString()} ${clock}`;
}

// Timeline placeholder while the session loads — the design carries a 14-row
// skeleton; returning null left the screen blank until data arrived.
function SessionSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col p-24 md:p-28">
      <div className="mb-12 h-12 w-160 animate-pulse rounded-4 bg-surface-inset" />
      <div className="mb-12 flex items-center gap-10">
        <div className="h-20 w-192 animate-pulse rounded-4 bg-surface-inset" />
        <div className="h-22 w-64 animate-pulse rounded-6 bg-surface-inset" />
      </div>
      <div className="mb-16 h-64 flex-none animate-pulse rounded-12 border-1 border-gray-6 bg-surface-raised" />
      <div className="min-h-0 flex-1 overflow-hidden rounded-12 border-1 border-gray-6 bg-surface-raised p-16 md:p-20">
        <div className="flex flex-col gap-12">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-12">
              <div className="h-12 w-40 flex-none animate-pulse rounded-4 bg-surface-inset" />
              <div className="size-20 flex-none animate-pulse rounded-6 bg-surface-inset" />
              <div
                className="h-12 animate-pulse rounded-4 bg-surface-inset"
                style={{ width: `${38 + ((i * 7) % 45)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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

// Prefer the top in-app frame — mirrors the collector's fingerprint.ts
// convention (`stack?.find(f => f.inApp) ?? stack?.[0]`) — over a leading
// vendor/framework frame; symbolicated frames win over raw ones when both
// are present.
function pickCulpritFrame(payload: SignalPayload): SignalStackFrame | undefined {
  const sym = payload.stackSymbolicated;
  if (sym !== undefined && sym.length > 0) {
    return sym.find((f) => f.inApp) ?? sym[0];
  }
  const raw = payload.stack;
  if (raw !== undefined && raw.length > 0) {
    return raw.find((f) => f.inApp) ?? raw[0];
  }
  return undefined;
}

function errorCulprit(payload: SignalPayload, mechanism: string | null): string | undefined {
  const frame = pickCulpritFrame(payload);
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
  // The wire type says `PlatformInfo | null`, but a row whose payload never
  // set `platform` deserializes as undefined, not null — treat that the
  // same as "no platform data" rather than crashing on `platform.browser`.
  if (platform == null) {
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
  const { copied, failed, copy } = useCopy();

  return (
    <button
      type="button"
      onClick={() => void copy(sessionId)}
      className="h-32 flex-none rounded-8 border-1 border-gray-7 bg-surface-raised px-13 font-sans text-[12.5px] font-500 text-gray-12 hover:border-gray-9 hover:bg-surface-inset"
    >
      {copied ? 'Copied' : failed ? 'Copy failed' : '⧉ Copy session id'}
    </button>
  );
}

function ErrorCard({ row }: { row: SessionEventRow }) {
  const culprit = errorCulprit(row.payload, row.mechanism);
  return (
    <div className="rounded-12 border-1 border-red-9 bg-red-3 px-14 py-11">
      <div className="flex items-center gap-10">
        <span className="flex-none font-mono text-13 font-600 text-red-9">{row.name}</span>
        <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-gray-12">{row.message}</span>
        {row.issueId !== null && row.issueKey !== null ? (
          <Link
            to="/signals/issues/$issueId"
            params={{ issueId: String(row.issueId) }}
            className="inline-flex h-26 flex-none items-center rounded-6 border-1 border-red-9 px-10 font-sans text-11 font-500 text-red-9 hover:bg-red-9/10"
          >
            View issue {row.issueKey} →
          </Link>
        ) : null}
      </div>
      {culprit !== undefined ? <div className="mt-5 font-mono text-11 text-gray-11">{culprit}</div> : null}
    </div>
  );
}

function TimelineRow({ item, startedAt, isFirst, isLast }: { item: TimelineItem; startedAt: string; isFirst: boolean; isLast: boolean }) {
  const lineClass = 'w-[1.5px] flex-none bg-gray-6';
  return (
    <div className="flex items-stretch">
      <span
        className={cn(
          'flex w-64 flex-none justify-end pt-2 font-mono text-11',
          item.type === 'row' && item.row.kind === 'error' ? 'text-red-9' : 'text-gray-9',
        )}
      >
        {item.type === 'row' ? elapsedLabel(item.row.clientTimestamp, startedAt) : null}
      </span>
      <span className="flex w-44 flex-none flex-col items-center">
        <span className={cn(lineClass, 'h-8', isFirst && 'bg-transparent')} />
        {item.type === 'row' ? (
          <Icon
            name={signalKindIcon(toSignalKind(item.row.kind))}
            tone={item.row.level === 'warning' ? 'warning' : signalKindTone(toSignalKind(item.row.kind))}
            size="xs"
            label={toSignalKind(item.row.kind)}
          />
        ) : (
          <span className="py-2 font-mono text-10 text-gray-9">┆</span>
        )}
        <span className={cn(lineClass, 'flex-1', isLast && 'bg-transparent')} />
      </span>
      <span className="min-w-0 flex-1 py-2 pb-10 pl-12">
        {item.type === 'gap' ? (
          <Pill
            tone="secondary"
            variant="outline"
            shape="round"
            label={`${item.seconds}s idle`}
            className="border-dashed border-gray-7 font-mono text-[10.5px]"
          />
        ) : item.row.kind === 'error' ? (
          <ErrorCard row={item.row} />
        ) : (
          <span className="flex min-h-22 items-center gap-9">
            <span
              className={cn(
                'w-74 flex-none font-mono text-[10.5px]',
                // A warning-level log stands out in the run-up to a crash.
                item.row.level === 'warning' ? 'text-orange-9' : 'text-gray-9',
              )}
            >
              {item.row.level === 'warning' && item.row.kind === 'log'
                ? 'console.warn'
                : kindLabel(item.row.kind)}
            </span>
            <span
              className={cn(
                'truncate',
                item.row.level === 'warning'
                  ? 'font-mono text-12 text-orange-9'
                  : item.row.kind === 'event'
                    ? 'font-sans text-[12.5px] text-gray-12'
                    : 'font-mono text-12 text-gray-12',
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
    <div className="flex h-full items-center justify-center p-24">
      <ScreenState
        title="Session not found"
        action={
          <Link to="/signals" className="font-sans text-12/17 text-indigo-9 hover:underline">
            ‹ Back to Issues
          </Link>
        }
      />
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-24">
      <ScreenState
        className="max-w-460"
        tone="danger"
        icon="triangle-alert"
        title="Couldn't load session"
        body="The signals daemon isn't responding. Check that it's running, then try again."
        action={
          <button
            type="button"
            onClick={onRetry}
            className="h-32 rounded-8 border-1 border-gray-7 bg-surface-raised px-13 font-sans text-[12.5px] font-500 text-gray-12 hover:bg-surface-inset"
          >
            ↻ Retry
          </button>
        }
      />
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
    return <SessionSkeleton />;
  }

  if (sessionQuery.isError) {
    const notFound = sessionQuery.error instanceof ApiError && sessionQuery.error.status === 404;
    return notFound ? <NotFound /> : <LoadError onRetry={() => void sessionQuery.refetch()} />;
  }

  if (sessionQuery.data === undefined) {
    return null;
  }

  const { session, rows } = sessionQuery.data;
  const errorRow = rows.find((row) => row.kind === 'error' && row.issueId !== null && row.issueKey !== null);
  const user = headerUser(rows[0]?.payload.user);
  const total = session.counts.error + session.counts.log + session.counts.event;
  const timeline = buildTimeline(rows);

  return (
    <div className="flex h-full min-h-0 flex-col p-24 md:p-28">
      <div className="mb-12 font-mono text-12 text-gray-9">
        <Link to="/signals" className="text-indigo-9 hover:underline">
          ‹ Issues
        </Link>
        {errorRow !== undefined ? (
          <>
            {' '}
            /{' '}
            <Link
              to="/signals/issues/$issueId"
              params={{ issueId: String(errorRow.issueId) }}
              className="text-indigo-9 hover:underline"
            >
              {errorRow.issueKey}
            </Link>{' '}
            / session
          </>
        ) : null}
      </div>

      <div className="mb-12 flex items-start gap-12">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-10">
            <span className="font-mono text-18 font-600 text-gray-12">{session.sessionId}</span>
            <span className="inline-flex h-22 items-center rounded-6 bg-surface-inset px-8 font-mono text-11 font-500 text-gray-11">
              {session.appSlug ?? `app ${session.appId}`}
            </span>
            {user !== undefined ? (
              <span className="inline-flex items-center gap-6 font-sans text-12 text-gray-11">
                <span className="flex size-18 items-center justify-center rounded-full bg-indigo-3 font-sans text-9 font-600 text-indigo-9">
                  {user.initials}
                </span>
                {user.label}
              </span>
            ) : null}
            {session.crashed ? (
              <Pill
                tone="danger"
                icon={<Icon name="dot" size="2xs" />}
                label="crashed"
                className="text-11 font-600"
              />
            ) : null}
          </div>
          <div className="mt-6 font-sans text-12 text-gray-9">
            One page load, everything it reported, in order — the error is the terminal point.
          </div>
        </div>
        <CopySessionIdButton sessionId={session.sessionId} />
      </div>

      <div className="mb-16 flex flex-none items-center gap-26 rounded-12 border-1 border-gray-6 bg-surface-raised px-18 py-12">
        <div>
          <div className="mb-3 font-mono text-10 font-500 tracking-wide text-gray-9">STARTED</div>
          <div className="font-mono text-13 font-500 text-gray-12">{formatStartedAt(session.startedAt)}</div>
        </div>
        <div>
          <div className="mb-3 font-mono text-10 font-500 tracking-wide text-gray-9">DURATION</div>
          <div className="font-mono text-13 font-500 text-gray-12">
            {session.durationMs !== null ? formatDurationMs(session.durationMs) : '—'}
          </div>
        </div>
        <div>
          <div className="mb-3 font-mono text-10 font-500 tracking-wide text-gray-9">SIGNALS</div>
          <div className="font-sans text-13 text-gray-12">
            <span className="font-mono text-13 font-500">{formatCount(total)}</span>{' '}
            <span className="font-mono text-11 text-gray-9">
              · {plural(session.counts.log, 'log')} · {plural(session.counts.event, 'event')} ·{' '}
              {plural(session.counts.error, 'error')}
            </span>
          </div>
        </div>
        <div>
          <div className="mb-3 font-mono text-10 font-500 tracking-wide text-gray-9">RELEASE</div>
          <div className="font-mono text-13 text-gray-12">{session.release ?? '—'}</div>
        </div>
        <div>
          <div className="mb-3 font-mono text-10 font-500 tracking-wide text-gray-9">BROWSER</div>
          <div className="font-sans text-13 text-gray-12">{formatPlatform(session.platform)}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-12 border-1 border-gray-6 bg-surface-raised p-16 md:p-20">
        <div className="flex max-w-980 flex-col">
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
