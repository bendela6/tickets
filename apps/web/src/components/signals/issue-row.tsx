import type { IssueRow as IssueRowData } from '../../api/signals/signals-api';
import { cn } from '../../ui/cn';
import { formatCount, relativeTime } from './format';
import { LevelDot } from './level-dot';
import { Sparkline } from './sparkline';
import { StatusChip } from './status-chip';

// Grid per docs/design/SigIssues.dc.html line 58: dot · issue · app · events ·
// first · last · sparkline · status · actions. Shared by the header row, data
// rows, and the loading skeleton so all three columns stay aligned.
export const ISSUES_GRID_COLUMNS = '36px minmax(0,1fr) 116px 78px 64px 64px 106px 158px 64px';

// issue.title arrives as `${name} — ${message}` (the collector's format);
// split on the FIRST ' — ' for a bold name + muted message. No match (no
// separator in the title) falls back to the whole title bold.
function splitTitle(title: string): { name: string; message: string | null } {
  const separator = ' — ';
  const index = title.indexOf(separator);
  if (index === -1) {
    return { name: title, message: null };
  }
  return { name: title.slice(0, index), message: title.slice(index + separator.length) };
}

export function IssueRow({
  issue,
  onOpen,
  onResolve,
  onIgnore,
}: {
  issue: IssueRowData;
  onOpen: () => void;
  onResolve: () => void;
  onIgnore: () => void;
}) {
  const { name, message } = splitTitle(issue.title);
  // Resolved/ignored issues read as settled — dim the whole row (~60% opacity
  // per the brief) rather than adding another status signal.
  const dimmed = issue.status !== 'open';
  const hot = issue.status === 'open' && (issue.spark[issue.spark.length - 1] ?? 0) > 0;

  return (
    <div
      role="row"
      onClick={onOpen}
      className={cn(
        'group relative grid h-13.5 cursor-pointer items-center border-b border-hairline px-3.5 hover:bg-app',
        dimmed && 'opacity-60',
      )}
      style={{ gridTemplateColumns: ISSUES_GRID_COLUMNS }}
    >
      <span className="flex">
        <LevelDot level={issue.level} />
      </span>
      <span className="min-w-0 pr-3">
        <span className="block truncate font-sans text-ui text-ink-2">
          <strong className="font-semibold text-ink">{name}</strong>
          {message !== null ? ` · ${message}` : null}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-3">
          {issue.culprit !== null ? `${issue.key} · ${issue.culprit}` : issue.key}
        </span>
      </span>
      <span>
        <span className="inline-flex h-5 max-w-25 items-center overflow-hidden rounded-ctrl bg-inset px-1.75 font-mono text-[10.5px] font-medium text-ink-2">
          {issue.appSlug}
        </span>
      </span>
      <span className="text-right font-mono text-[12px] font-medium text-ink">
        {formatCount(issue.eventCount)}
      </span>
      <span className="pl-3.5 font-mono text-[11px] text-ink-3">{relativeTime(issue.firstSeen)}</span>
      <span className={cn('font-mono text-[11px] font-medium', hot ? 'text-ink' : 'text-ink-3')}>
        {relativeTime(issue.lastSeen)}
      </span>
      <span className="pl-1.5">
        <Sparkline counts={issue.spark} hot={hot} />
      </span>
      <span className="pl-1">
        <StatusChip status={issue.status} />
      </span>
      {/* Hover-revealed row actions, mirroring board/table-view.tsx's RowActions. */}
      <span
        className="flex justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          title="Resolve"
          aria-label="Resolve"
          onClick={onResolve}
          className="hidden size-6 items-center justify-center rounded-md text-ink-3 hover:bg-kind-done-subtle hover:text-kind-done group-hover:flex"
        >
          ✓
        </button>
        <button
          type="button"
          title="Ignore"
          aria-label="Ignore"
          onClick={onIgnore}
          className="hidden size-6 items-center justify-center rounded-md text-ink-3 hover:bg-inset hover:text-ink group-hover:flex"
        >
          ⊘
        </button>
      </span>
    </div>
  );
}

// Loading placeholder — 8 of these keep the same column grid as real rows so
// the table doesn't reflow when data arrives.
export function IssueRowSkeleton() {
  return (
    <div
      role="row"
      aria-hidden
      className="grid h-13.5 animate-pulse items-center border-b border-hairline px-3.5"
      style={{ gridTemplateColumns: ISSUES_GRID_COLUMNS }}
    >
      <span className="size-2.25 rounded-full bg-inset" />
      <span>
        <span className="block h-2.75 w-3/5 rounded-xs bg-inset" />
        <span className="mt-1.5 block h-2 w-2/5 rounded-xs bg-inset" />
      </span>
      <span className="inline-block h-3.5 w-18 rounded-xs bg-inset" />
      <span className="flex justify-end">
        <span className="inline-block h-2.75 w-8 rounded-xs bg-inset" />
      </span>
      <span className="pl-3.5">
        <span className="inline-block h-2.25 w-6.5 rounded-xs bg-inset" />
      </span>
      <span>
        <span className="inline-block h-2.25 w-6.5 rounded-xs bg-inset" />
      </span>
      <span className="pl-1.5">
        <span className="inline-block h-3 w-23 rounded-xs bg-inset" />
      </span>
      <span className="pl-1">
        <span className="inline-block h-4 w-16 rounded-md bg-inset" />
      </span>
      <span />
    </div>
  );
}
