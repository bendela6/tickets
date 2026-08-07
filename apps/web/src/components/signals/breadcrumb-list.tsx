import { Link } from '@tanstack/react-router';
import type { SignalBreadcrumb } from '../../api/signals/signals-api';
import { cn, Icon, Pill } from '@tickets/ui';
import { signalKindIcon, signalKindTone, type SignalKind } from '../../domain/signal-status';
import { formatClockTime, formatDurationMs } from './format';

const BREADCRUMB_GRID_COLUMNS = '30px 84px minmax(0,1fr) auto';

// Breadcrumb `type` is a closed wire union — 'console' | 'click' |
// 'navigation' | 'http' | 'custom' (packages/signals/core/src/types.ts).
// There is no 'error' (or 'fetch'/'xhr') breadcrumb type on the wire; the SDK
// never emits one, so those mappings are commented out rather than left live
// dead code that implies a breadcrumb can be terminal on its own. ('error'
// stays a valid `SignalKind` for the session timeline — see
// session-screen.tsx's toSignalKind — just not a breadcrumb `type`.) The
// terminal danger row is synthesized separately by the caller from the
// matched error signal itself; see BreadcrumbList's `terminal` prop.
function kindForType(type: string): SignalKind {
  if (type === 'navigation') return 'navigation';
  if (type === 'click') return 'click';
  if (type === 'http') return 'http';
  // if (type === 'fetch' || type === 'xhr') return 'http'; // not wire-legal
  // if (type === 'error') return 'error'; // not wire-legal for breadcrumbs
  if (type.startsWith('console')) return 'log';
  return 'custom';
}

function HttpStatusPill({ status }: { status: number }) {
  const ok = status < 400;
  return (
    <Pill
      tone={ok ? 'green' : 'danger'}
      label={status}
      className={cn('h-17 rounded-4 px-6 font-mono text-10', !ok && 'font-600')}
    />
  );
}

function BreadcrumbRow({ crumb }: { crumb: SignalBreadcrumb }) {
  const kind = kindForType(crumb.type);
  const status = typeof crumb.data?.status === 'number' ? crumb.data.status : undefined;
  const durationMs = typeof crumb.data?.durationMs === 'number' ? crumb.data.durationMs : undefined;

  // A console breadcrumb records which method produced it (data.method, set by
  // the browser SDK's console instrumentation). warn/error consoles are worth
  // seeing at a glance in the run-up to a crash, so they get the amber/danger
  // tint the design shows instead of the neutral log styling.
  const consoleMethod = typeof crumb.data?.method === 'string' ? crumb.data.method : undefined;
  const tone = consoleMethod === 'warn' ? 'warn' : consoleMethod === 'error' ? 'error' : 'neutral';

  return (
    <div
      role="row"
      className="grid items-center gap-x-10 border-b-1 border-gray-6 px-16 py-6 last:border-b-0"
      style={{ gridTemplateColumns: BREADCRUMB_GRID_COLUMNS }}
    >
      <Icon
        name={signalKindIcon(kind)}
        tone={tone === 'warn' ? 'warning' : tone === 'error' ? 'danger' : signalKindTone(kind)}
        size="xs"
        label={kind}
      />
      <span className="font-mono text-[10.5px] text-gray-9">
        {consoleMethod === 'warn' || consoleMethod === 'error' ? `console.${consoleMethod}` : crumb.type}
      </span>
      <span className="flex min-w-0 items-center gap-8">
        <span
          className={cn(
            'truncate font-mono text-12',
            tone === 'warn' ? 'text-orange-9' : tone === 'error' ? 'text-red-9' : 'text-gray-11',
          )}
        >
          {crumb.message ?? ''}
        </span>
        {status !== undefined ? <HttpStatusPill status={status} /> : null}
        {durationMs !== undefined ? (
          <span className="shrink-0 font-mono text-[10.5px] text-gray-9">{formatDurationMs(durationMs)}</span>
        ) : null}
      </span>
      <span className="font-mono text-11 text-gray-9">{formatClockTime(crumb.timestamp)}</span>
    </div>
  );
}

// The terminal row's data — the matched error signal itself, not a
// breadcrumb (there's no wire-legal 'error' breadcrumb type to pull it
// from). `message` mirrors SessionEventRow.message: nullable.
export interface TerminalBreadcrumb {
  name: string;
  message: string | null;
  clientTimestamp: string;
}

function TerminalBreadcrumbRow({ terminal }: { terminal: TerminalBreadcrumb }) {
  return (
    <div
      role="row"
      className="grid items-center gap-x-10 bg-red-3 px-16 py-6"
      style={{ gridTemplateColumns: BREADCRUMB_GRID_COLUMNS }}
    >
      <span className="flex size-20 items-center justify-center rounded-6 bg-red-9 font-mono text-10 font-600 text-red-contrast">
        ✕
      </span>
      <span className="font-mono text-[10.5px] font-500 text-red-9">{terminal.name}</span>
      <span className="flex min-w-0 items-center gap-8">
        <span className="truncate font-mono text-12 font-500 text-red-9">{terminal.message ?? ''}</span>
      </span>
      <span className="font-mono text-11 font-500 text-red-9">
        {formatClockTime(terminal.clientTimestamp)}
      </span>
    </div>
  );
}

/**
 * Breadcrumbs card (docs/design/SigIssueDetail.dc.html): the signals leading
 * up to the occurrence shown in the stack trace, ending in a terminal
 * danger-colored row for the error itself. The terminal row is NOT inferred
 * from the breadcrumb list (breadcrumb `type` has no 'error' member on the
 * wire — see kindForType above) — the caller synthesizes it from the matched
 * error signal (name/message/clientTimestamp) and passes it explicitly.
 * `sessionId` drives the "full session →" link — omitted while the newest
 * occurrence's session hasn't resolved yet.
 */
export function BreadcrumbList({
  breadcrumbs,
  terminal,
  sessionId,
}: {
  breadcrumbs: SignalBreadcrumb[] | undefined;
  terminal: TerminalBreadcrumb | undefined;
  sessionId: string | undefined;
}) {
  const rows = breadcrumbs ?? [];

  return (
    <div className="flex-none overflow-hidden rounded-12 border-1 border-gray-6 bg-surface-raised">
      <div className="flex h-42 items-center gap-10 border-b-1 border-gray-6 px-16">
        <span className="font-sans text-[13.5px] font-600 text-gray-12">Breadcrumbs</span>
        {rows.length > 0 ? (
          <span className="font-mono text-11 text-gray-9">
            the {rows.length} signals before this occurrence
          </span>
        ) : null}
        <span className="flex-1" />
        {sessionId !== undefined ? (
          <Link
            to="/signals/sessions/$sessionId"
            params={{ sessionId }}
            className="font-mono text-[11.5px] text-indigo-9 hover:underline"
          >
            full session →
          </Link>
        ) : null}
      </div>
      {rows.length === 0 && terminal === undefined ? (
        <div className="px-16 py-16 font-mono text-[11.5px] text-gray-9">no breadcrumbs recorded</div>
      ) : (
        <div>
          {rows.map((crumb, index) => (
            <BreadcrumbRow key={index} crumb={crumb} />
          ))}
          {terminal !== undefined ? <TerminalBreadcrumbRow terminal={terminal} /> : null}
        </div>
      )}
    </div>
  );
}
