// The version line at the foot of the sidebar: the stack's version and when
// it was released, linking to the Version page. A dot marks a version this
// browser has not seen; Reload shows when a newer one is live.

import { Link } from '@tanstack/react-router';
import { Tag } from 'lucide-react';
import { cn, Tooltip } from '@bh/ui';
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

/** `v0.4.1 · 17 Oct 2026, 14:32`: on a dev server, the build's time. */
export function versionLine(info: BuildInfo): string {
  const time = info.dev || info.stack.releasedAt === '' ? info.builtAt : info.stack.releasedAt;
  return `${versionLabel(info)} · ${formatReleaseTime(time)}`;
}

const NEW_DOT = 'size-6 shrink-0 rounded-full bg-indigo-9';

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
        'rounded-4 text-12 font-500 text-indigo-11 px-6 py-2 hover:underline',
        NAV_STYLES.focusRing,
      )}
    >
      Reload
    </button>
  ) : null;

  if (collapsed) {
    return (
      <div className="border-gray-6 shrink-0 border-t-1 px-8 py-6">
        <Tooltip content={live ? `${line} · v${live} is live` : line} side="right">
          <Link
            to={to}
            aria-label={`Version ${line}`}
            className={cn(
              'rounded-4 relative flex w-full items-center justify-center py-8',
              NAV_STYLES.focusRing,
              NAV_STYLES.control,
            )}
          >
            <Tag size={18} strokeWidth={1.75} />
            {unseen || live ? <span className={cn(NEW_DOT, 'absolute top-6 right-10')} /> : null}
          </Link>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-gray-6 flex shrink-0 flex-wrap items-center gap-x-4 border-t-1 px-8 py-6">
      <Link
        to={to}
        className={cn(
          'rounded-4 text-12 text-gray-10 hover:text-gray-12 flex min-w-0 flex-1 flex-wrap items-center gap-x-6 px-6 py-4',
          NAV_STYLES.focusRing,
        )}
      >
        {unseen ? <span className={NEW_DOT} aria-label="New version" role="img" /> : null}
        {info.dev ? (
          <span className="rounded-4 bg-orange-3 text-orange-11 font-500 text-11 px-4 py-1">
            dev
          </span>
        ) : null}
        <span className="text-gray-12 font-500 font-mono">{line.split(' · ')[0]}</span>
        <span>· {line.split(' · ')[1]}</span>
      </Link>
      {reload}
    </div>
  );
}
