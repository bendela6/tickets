import { Link } from '@tanstack/react-router';
import type { SignalListRow } from '../../api/signals/signals-api';
import { relativeTime } from './format';
import { KindGlyph } from './kind-glyph';
import { LevelDot } from './level-dot';

// Grid: kind glyph · level dot · name/message · app · when · session link.
// One extra column vs. ISSUES_GRID_COLUMNS (issue-row.tsx) since a log/event
// row carries both a kind glyph (log vs. event, per kind-glyph.tsx) AND a
// level dot (info/warning/error, per level-dot.tsx) — an issue row only
// needs the level dot, kind is implicit ("issue"). Shared by the header row,
// data rows, and the loading skeleton so all columns stay aligned.
export const ACTIVITY_GRID_COLUMNS = '28px 22px minmax(0,1fr) 116px 60px 110px';

export function ActivityRow({ signal }: { signal: SignalListRow }) {
  return (
    <div
      role="row"
      className="grid h-11 items-center border-b border-hairline px-3.5 hover:bg-app"
      style={{ gridTemplateColumns: ACTIVITY_GRID_COLUMNS }}
    >
      <span className="flex">
        <KindGlyph type={signal.kind} />
      </span>
      <span className="flex">
        <LevelDot level={signal.level} />
      </span>
      <span className="min-w-0 pr-3">
        <span className="block truncate font-sans text-ui text-ink-2">
          {signal.name !== null ? <strong className="font-semibold text-ink">{signal.name}</strong> : null}
          {signal.message !== null ? (signal.name !== null ? ` · ${signal.message}` : signal.message) : null}
        </span>
      </span>
      <span>
        <span className="inline-flex h-5 max-w-25 items-center overflow-hidden rounded-ctrl bg-inset px-1.75 font-mono text-[10.5px] font-medium text-ink-2">
          {signal.appSlug}
        </span>
      </span>
      <span className="font-mono text-[11px] text-ink-3">{relativeTime(signal.receivedAt)}</span>
      <span>
        {signal.sessionId !== null ? (
          <Link
            to="/signals/sessions/$sessionId"
            params={{ sessionId: signal.sessionId }}
            className="font-mono text-[11px] font-medium text-accent hover:underline"
          >
            session →
          </Link>
        ) : (
          <span className="font-mono text-[11px] text-ink-3">—</span>
        )}
      </span>
    </div>
  );
}

// Title-bar width pairs, same convention as issue-row.tsx's
// SKELETON_TITLE_WIDTHS, so the loading skeleton reads like varied real
// content instead of a uniform stripe repeated 8 times.
const SKELETON_WIDTHS = [62, 48, 70, 55, 64, 42, 58, 50];

// Loading placeholder — keeps the same column grid as real rows so the
// table doesn't reflow when data arrives. `index` staggers the message bar
// width, matching IssueRowSkeleton's convention.
export function ActivityRowSkeleton({ index = 0 }: { index?: number }) {
  const width = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]!;
  return (
    <div
      role="row"
      aria-hidden
      className="grid h-11 animate-pulse items-center border-b border-hairline px-3.5"
      style={{ gridTemplateColumns: ACTIVITY_GRID_COLUMNS }}
    >
      <span className="size-3.5 rounded-[6px] bg-inset" />
      <span className="size-2.25 rounded-full bg-inset" />
      <span className="block h-2.75 rounded-xs bg-inset" style={{ width: `${width}%` }} />
      <span className="inline-block h-3.5 w-18 rounded-xs bg-inset" />
      <span className="inline-block h-2.25 w-6.5 rounded-xs bg-inset" />
      <span className="inline-block h-2.25 w-13 rounded-xs bg-inset" />
    </div>
  );
}
