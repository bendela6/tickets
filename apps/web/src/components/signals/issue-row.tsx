import type { IssueRow as IssueRowData } from '../../api/signals/signals-api';
import { signalStatus } from '../../domain/signal-status';
import { cn, Pill } from '@tickets/ui';
import { formatCount, relativeTime } from './format';
import { LevelDot } from './level-dot';
import { Sparkline } from './sparkline';

// Grid per docs/design/SigIssues.dc.html line 58: dot · issue · app · events ·
// first · last · sparkline · status · actions. Shared by the header row, data
// rows, and the loading skeleton so all three columns stay aligned.
export const ISSUES_GRID_COLUMNS = '36px minmax(0,1fr) 116px 78px 64px 64px 106px 158px 64px';

// issue.title arrives as `${name} — ${message}` (the collector's format);
// split on the FIRST ' — ' for a bold name + muted message. No match (no
// separator in the title) falls back to the whole title bold. Exported —
// issue-detail-screen.tsx's header reuses the same split.
export function splitTitle(title: string): { name: string; message: string | null } {
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
  onReopen,
}: {
  issue: IssueRowData;
  onOpen: () => void;
  onResolve: () => void;
  onIgnore: () => void;
  onReopen: () => void;
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
        'group relative grid h-13.5 cursor-pointer items-center border-b border-gray-6 px-3.5 hover:bg-gray-1',
        dimmed && 'opacity-60',
      )}
      style={{ gridTemplateColumns: ISSUES_GRID_COLUMNS }}
    >
      <span className="flex">
        <LevelDot level={issue.level} />
      </span>
      <span className="min-w-0 pr-3">
        <span className="block truncate font-sans text-13/19 text-gray-11">
          <strong className="font-600 text-gray-12">{name}</strong>
          {message !== null ? ` · ${message}` : null}
        </span>
        <span className="mt-0.5 block truncate font-mono text-11 text-gray-9">
          {issue.culprit !== null ? `${issue.key} · ${issue.culprit}` : issue.key}
        </span>
      </span>
      <span>
        <span className="inline-flex h-5 max-w-25 items-center overflow-hidden rounded-md bg-surface-inset px-1.75 font-mono text-[10.5px] font-500 text-gray-11">
          {issue.appSlug}
        </span>
      </span>
      <span className="text-right font-mono text-12 font-500 text-gray-12">
        {formatCount(issue.eventCount)}
      </span>
      <span className="pl-3.5 font-mono text-11 text-gray-9">{relativeTime(issue.firstSeen)}</span>
      <span className={cn('font-mono text-11 font-500', hot ? 'text-gray-12' : 'text-gray-9')}>
        {relativeTime(issue.lastSeen)}
      </span>
      <span className="pl-1.5">
        <Sparkline counts={issue.spark} hot={hot} />
      </span>
      <span className="pl-1">
        <Pill {...signalStatus(issue.status)} />
      </span>
      {/* Hover-revealed row actions, mirroring board/table-view.tsx's RowActions. */}
      <span
        className="flex justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        {/* A settled row offers the way back out; an open row offers the two
        ways in. Without this, resolve/ignore were one-way from the list. */}
        {issue.status !== 'open' ? (
          <button
            type="button"
            title="Reopen"
            aria-label="Reopen"
            onClick={onReopen}
            className="hidden size-6 items-center justify-center rounded-md text-gray-9 hover:bg-surface-inset hover:text-gray-12 group-hover:flex"
          >
            ↺
          </button>
        ) : null}
        {issue.status !== 'resolved' ? (
          <button
            type="button"
            title="Resolve"
            aria-label="Resolve"
            onClick={onResolve}
            className="hidden size-6 items-center justify-center rounded-md text-gray-9 hover:bg-green-3 hover:text-green-9 group-hover:flex"
          >
            ✓
          </button>
        ) : null}
        {issue.status !== 'ignored' ? (
          <button
            type="button"
            title="Ignore"
            aria-label="Ignore"
            onClick={onIgnore}
            className="hidden size-6 items-center justify-center rounded-md text-gray-9 hover:bg-surface-inset hover:text-gray-12 group-hover:flex"
          >
            ⊘
          </button>
        ) : null}
      </span>
    </div>
  );
}

// Title-bar width pairs (% of column) lifted straight from
// SigIssues.dc.html's `skels` array, so the loading skeleton reads like
// varied real content instead of a uniform stripe repeated 8 times.
const SKELETON_TITLE_WIDTHS: { w1: number; w2: number }[] = [
  { w1: 62, w2: 40 },
  { w1: 48, w2: 34 },
  { w1: 70, w2: 44 },
  { w1: 55, w2: 30 },
  { w1: 64, w2: 38 },
  { w1: 42, w2: 28 },
  { w1: 58, w2: 36 },
  { w1: 50, w2: 32 },
];

// Loading placeholder — 8 of these keep the same column grid as real rows so
// the table doesn't reflow when data arrives. `index` staggers the title/
// message bar widths per the design's `skels` fixture.
export function IssueRowSkeleton({ index = 0 }: { index?: number }) {
  const { w1, w2 } = SKELETON_TITLE_WIDTHS[index % SKELETON_TITLE_WIDTHS.length]!;
  return (
    <div
      role="row"
      aria-hidden
      className="grid h-13.5 animate-pulse items-center border-b border-gray-6 px-3.5"
      style={{ gridTemplateColumns: ISSUES_GRID_COLUMNS }}
    >
      <span className="size-2.25 rounded-full bg-surface-inset" />
      <span>
        <span className="block h-2.75 rounded-xs bg-surface-inset" style={{ width: `${w1}%` }} />
        <span className="mt-1.5 block h-2 rounded-xs bg-surface-inset" style={{ width: `${w2}%` }} />
      </span>
      <span className="inline-block h-3.5 w-18 rounded-xs bg-surface-inset" />
      <span className="flex justify-end">
        <span className="inline-block h-2.75 w-8 rounded-xs bg-surface-inset" />
      </span>
      <span className="pl-3.5">
        <span className="inline-block h-2.25 w-6.5 rounded-xs bg-surface-inset" />
      </span>
      <span>
        <span className="inline-block h-2.25 w-6.5 rounded-xs bg-surface-inset" />
      </span>
      <span className="pl-1.5">
        <span className="inline-block h-3 w-23 rounded-xs bg-surface-inset" />
      </span>
      <span className="pl-1">
        <span className="inline-block h-4 w-16 rounded-md bg-surface-inset" />
      </span>
      <span />
    </div>
  );
}
