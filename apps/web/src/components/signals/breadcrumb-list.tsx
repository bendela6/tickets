import { Link } from '@tanstack/react-router';
import type { SignalBreadcrumb } from '../../api/signals/signals-api';
import { cn } from '../../ui/cn';
import { formatClockTime, formatDurationMs } from './format';
import type { SignalKind } from './kind-glyph';
import { KindGlyph } from './kind-glyph';

const BREADCRUMB_GRID_COLUMNS = '30px 84px minmax(0,1fr) auto';

// Breadcrumb `type` is a closed wire union — 'console' | 'click' |
// 'navigation' | 'http' | 'custom' (packages/signals/core/src/types.ts).
// There is no 'error' (or 'fetch'/'xhr') breadcrumb type on the wire; the SDK
// never emits one, so those mappings are commented out rather than left live
// dead code that implies a breadcrumb can be terminal on its own. ('error'
// stays a valid KindGlyph *signal kind* for the session timeline — see
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

function HttpStatusChip({ status }: { status: number }) {
  const ok = status < 400;
  return (
    <span
      className={cn(
        'inline-flex h-4.25 shrink-0 items-center rounded-[4px] px-1.5 font-mono text-[10px]',
        ok ? 'bg-kind-done-subtle font-medium text-kind-done' : 'bg-danger-subtle font-semibold text-danger',
      )}
    >
      {status}
    </span>
  );
}

function BreadcrumbRow({ crumb }: { crumb: SignalBreadcrumb }) {
  const kind = kindForType(crumb.type);
  const status = typeof crumb.data?.status === 'number' ? crumb.data.status : undefined;
  const durationMs = typeof crumb.data?.durationMs === 'number' ? crumb.data.durationMs : undefined;

  return (
    <div
      role="row"
      className="grid items-center gap-x-2.5 border-b border-hairline px-4 py-1.5 last:border-b-0"
      style={{ gridTemplateColumns: BREADCRUMB_GRID_COLUMNS }}
    >
      <KindGlyph type={kind} />
      <span className="font-mono text-[10.5px] text-ink-3">{crumb.type}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[12px] text-ink-2">{crumb.message ?? ''}</span>
        {status !== undefined ? <HttpStatusChip status={status} /> : null}
        {durationMs !== undefined ? (
          <span className="shrink-0 font-mono text-[10.5px] text-ink-3">{formatDurationMs(durationMs)}</span>
        ) : null}
      </span>
      <span className="font-mono text-[11px] text-ink-3">{formatClockTime(crumb.timestamp)}</span>
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
      className="grid items-center gap-x-2.5 bg-danger-subtle px-4 py-1.5"
      style={{ gridTemplateColumns: BREADCRUMB_GRID_COLUMNS }}
    >
      <span className="flex size-5 items-center justify-center rounded-[6px] bg-danger font-mono text-[10px] font-semibold text-on-danger">
        ✕
      </span>
      <span className="font-mono text-[10.5px] font-medium text-danger">{terminal.name}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[12px] font-medium text-danger">{terminal.message ?? ''}</span>
      </span>
      <span className="font-mono text-[11px] font-medium text-danger">
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
    <div className="flex-none overflow-hidden rounded-xl border border-hairline bg-raised">
      <div className="flex h-10.5 items-center gap-2.5 border-b border-hairline px-4">
        <span className="font-sans text-[13.5px] font-semibold text-ink">Breadcrumbs</span>
        {rows.length > 0 ? (
          <span className="font-mono text-[11px] text-ink-3">
            the {rows.length} signals before this occurrence
          </span>
        ) : null}
        <span className="flex-1" />
        {sessionId !== undefined ? (
          <Link
            to="/signals/sessions/$sessionId"
            params={{ sessionId }}
            className="font-mono text-[11.5px] text-accent hover:underline"
          >
            full session →
          </Link>
        ) : null}
      </div>
      {rows.length === 0 && terminal === undefined ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">no breadcrumbs recorded</div>
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
