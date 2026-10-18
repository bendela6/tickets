// The version line, under the app's name at the top of the sidebar: the stack's
// version and how long ago it was released, linking to the Version page. A dot
// marks a version this browser has not seen; Reload shows when a newer one is
// live.

import { Link } from '@tanstack/react-router';
import { cn, RelativeDate } from '@bh/ui';
import { NAV_STYLES } from '../nav';
import { versionLabel, type BuildInfo } from './build-info';
import { formatReleaseTime } from './release-time';
import { useLiveVersion } from './use-live-version';
import { seenKey, useSeenVersion } from './use-seen-version';

/** Props for BuildLine component. */
export interface BuildLineProps {
  /** The build's versions: `readBuildInfo()`. */
  info: BuildInfo;
  /** The Version page's path. */
  to?: string;
}

/** The line's time: the release's; on a dev server, or before a release, the build's. */
function timeOf(info: BuildInfo): string {
  return info.dev || info.stack.releasedAt === '' ? info.builtAt : info.stack.releasedAt;
}

/** `v0.4.1 · 17 Oct 2026, 14:32`, the line's name. */
export function versionLine(info: BuildInfo): string {
  return `${versionLabel(info)} · ${formatReleaseTime(timeOf(info))}`;
}

const NEW_DOT = 'size-6 shrink-0 rounded-full bg-indigo-9';

/**
 * The line, as the brand's `caption`: AppShell draws it under the name while
 * the sidebar is expanded. It wraps when the sidebar is narrow.
 */
export function BuildLine({ info, to = '/version' }: BuildLineProps) {
  const line = versionLine(info);
  const live = useLiveVersion(info);
  const unseen = useSeenVersion(seenKey(info.stack.name), info.stack.version);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-6">
      <Link
        to={to}
        aria-label={`Version ${line}`}
        className={cn(
          'group rounded-4 text-11/16 text-gray-9 hover:text-gray-11 flex min-w-0 flex-wrap items-center gap-x-6',
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
      {live ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={cn(
            'rounded-4 text-11/16 font-500 text-indigo-11 hover:underline',
            NAV_STYLES.focusRing,
          )}
        >
          Reload
        </button>
      ) : null}
    </div>
  );
}
