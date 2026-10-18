// The version line, last in the sidebar's footer: the stack's version and how
// long ago it was released, linking to the Version page. A dot marks a version
// this browser has not seen; Reload shows when a newer one is live.

import { Link } from '@tanstack/react-router';
import { Tag } from 'lucide-react';
import { cn, RelativeDate, Tooltip } from '@bh/ui';
import { NAV_STYLES } from '../nav';
import { versionLabel, type BuildInfo } from './build-info';
import { formatReleaseTime } from './release-time';
import { useLiveVersion } from './use-live-version';
import { seenKey, useSeenVersion } from './use-seen-version';

/** Props for BuildFooter component. */
export interface BuildFooterProps {
  /** The build's versions: `readBuildInfo()`. */
  info: BuildInfo;
  /** Whether the sidebar is at rail width — what AppShell's `footer` is told. */
  collapsed: boolean;
  /** The Version page's path. */
  to?: string;
}

/** The line's time: the release's; on a dev server, or before a release, the build's. */
function timeOf(info: BuildInfo): string {
  return info.dev || info.stack.releasedAt === '' ? info.builtAt : info.stack.releasedAt;
}

/** `v0.4.1 · 17 Oct 2026, 14:32`, for the rail's tooltip and the line's name. */
export function versionLine(info: BuildInfo): string {
  return `${versionLabel(info)} · ${formatReleaseTime(timeOf(info))}`;
}

const NEW_DOT = 'size-6 shrink-0 rounded-full bg-indigo-9';
// Room below for the browser's link preview, which covers the window's
// bottom-left corner while a link is pointed at.
const BOX = 'shrink-0 px-8 pt-2 pb-32';

/**
 * Expanded, the line itself, wrapping when the sidebar is narrow; at rail
 * width, one icon with the line as its tooltip, which needs a
 * `TooltipProvider` above the shell.
 */
export function BuildFooter({ info, collapsed, to = '/version' }: BuildFooterProps) {
  const line = versionLine(info);
  const live = useLiveVersion(info);
  const unseen = useSeenVersion(seenKey(info.stack.name), info.stack.version);
  const reload = live ? (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className={cn(
        'rounded-4 text-11 font-500 text-indigo-11 px-6 py-2 hover:underline',
        NAV_STYLES.focusRing,
      )}
    >
      Reload
    </button>
  ) : null;

  if (collapsed) {
    return (
      <div className={BOX}>
        <Tooltip content={live ? `${line} · v${live} is live` : line} side="right">
          <Link
            to={to}
            aria-label={`Version ${line}`}
            className={cn(
              'rounded-4 text-gray-9 hover:bg-surface-inset hover:text-gray-11 relative flex w-full items-center justify-center py-6',
              NAV_STYLES.focusRing,
            )}
          >
            <Tag size={16} strokeWidth={1.75} />
            {unseen || live ? <span className={cn(NEW_DOT, 'absolute top-6 right-10')} /> : null}
          </Link>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn(BOX, 'flex flex-wrap items-center gap-x-4')}>
      <Link
        to={to}
        aria-label={`Version ${line}`}
        className={cn(
          'group rounded-4 text-11/16 text-gray-9 hover:text-gray-11 flex min-w-0 flex-1 flex-wrap items-center gap-x-6 px-6 py-2',
          NAV_STYLES.focusRing,
        )}
      >
        {unseen ? <span className={NEW_DOT} aria-label="New version" role="img" /> : null}
        {info.dev ? (
          <span className="rounded-4 bg-orange-3 text-orange-11 font-500 text-10 px-4">dev</span>
        ) : null}
        <span className="font-mono">{versionLabel(info)}</span>
        <span aria-hidden>·</span>
        <RelativeDate
          value={timeOf(info)}
          smallestUnit="minute"
          className="text-11/16 text-gray-9 group-hover:text-gray-11"
        />
      </Link>
      {reload}
    </div>
  );
}
