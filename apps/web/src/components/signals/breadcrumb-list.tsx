import { Link } from '@tanstack/react-router';
import type { SignalBreadcrumb } from '../../api/signals/signals-api';
import { cn } from '../../ui/cn';
import { formatClockTime, formatDurationMs } from './format';
import type { SignalKind } from './kind-glyph';
import { KindGlyph } from './kind-glyph';

const BREADCRUMB_GRID_COLUMNS = '30px 84px minmax(0,1fr) auto';

// Breadcrumb `type` strings are whatever the SDK's instrumentation emits
// (console/console.warn, fetch/xhr, navigation, click, error, …) — map the
// common ones onto KindGlyph's fixed glyph set; anything unrecognized falls
// back to the neutral "custom" badge rather than crashing on an unknown key.
function kindForType(type: string): SignalKind {
  if (type === 'navigation') return 'navigation';
  if (type === 'click') return 'click';
  if (type === 'fetch' || type === 'http' || type === 'xhr') return 'http';
  if (type === 'error') return 'error';
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

function BreadcrumbRow({ crumb, terminal }: { crumb: SignalBreadcrumb; terminal: boolean }) {
  const kind = kindForType(crumb.type);
  const status = typeof crumb.data?.status === 'number' ? crumb.data.status : undefined;
  const durationMs = typeof crumb.data?.durationMs === 'number' ? crumb.data.durationMs : undefined;

  return (
    <div
      role="row"
      className={cn(
        'grid items-center gap-x-2.5 px-4 py-1.5',
        terminal ? 'bg-danger-subtle' : 'border-b border-hairline last:border-b-0',
      )}
      style={{ gridTemplateColumns: BREADCRUMB_GRID_COLUMNS }}
    >
      {terminal ? (
        <span className="flex size-5 items-center justify-center rounded-[6px] bg-danger font-mono text-[10px] font-semibold text-on-danger">
          ✕
        </span>
      ) : (
        <KindGlyph type={kind} />
      )}
      <span className={cn('font-mono text-[10.5px]', terminal ? 'font-medium text-danger' : 'text-ink-3')}>
        {crumb.type}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'truncate font-mono text-[12px]',
            terminal ? 'font-medium text-danger' : 'text-ink-2',
          )}
        >
          {crumb.message ?? ''}
        </span>
        {status !== undefined ? <HttpStatusChip status={status} /> : null}
        {durationMs !== undefined ? (
          <span className="shrink-0 font-mono text-[10.5px] text-ink-3">{formatDurationMs(durationMs)}</span>
        ) : null}
      </span>
      <span className={cn('font-mono text-[11px]', terminal ? 'font-medium text-danger' : 'text-ink-3')}>
        {formatClockTime(crumb.timestamp)}
      </span>
    </div>
  );
}

/**
 * Breadcrumbs card (docs/design/SigIssueDetail.dc.html): the signals leading
 * up to the occurrence shown in the stack trace, ending in a terminal
 * danger-colored row for the error itself. `sessionId` drives the "full
 * session →" link — omitted while the newest occurrence's session hasn't
 * resolved yet.
 */
export function BreadcrumbList({
  breadcrumbs,
  sessionId,
}: {
  breadcrumbs: SignalBreadcrumb[] | undefined;
  sessionId: string | undefined;
}) {
  const rows = breadcrumbs ?? [];
  const lastIndex = rows.length - 1;

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
      {rows.length === 0 ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">no breadcrumbs recorded</div>
      ) : (
        <div>
          {rows.map((crumb, index) => (
            <BreadcrumbRow
              key={index}
              crumb={crumb}
              terminal={index === lastIndex && kindForType(crumb.type) === 'error'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
