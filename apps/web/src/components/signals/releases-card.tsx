import { useState } from 'react';
import type { AppReleaseRow } from '../../api/signals/signals-api';
import { useAppReleases, useDeleteRelease } from '../../api/signals/use-signals';
import { cn, ConfirmDialog } from '@tickets/ui';
import { formatBytes, formatCount, relativeTime } from './format';

// release · signals · errors · source maps (count + bytes) · last seen · delete.
const RELEASES_GRID_COLUMNS = 'minmax(0,1fr) 76px 76px 150px 84px 36px';

function ReleaseRow({ appId, release }: { appId: number; release: AppReleaseRow }) {
  const deleteRelease = useDeleteRelease();
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      role="row"
      className="grid h-8.5 items-center border-b border-gray-6 px-4 last:border-b-0"
      style={{ gridTemplateColumns: RELEASES_GRID_COLUMNS }}
    >
      <span className="truncate font-mono text-[11.5px] font-500 text-gray-12">{release.release}</span>
      <span className="text-right font-mono text-[11.5px] text-gray-12">{formatCount(release.signalCount)}</span>
      <span
        className={cn(
          'text-right font-mono text-[11.5px]',
          release.errorCount > 0 ? 'font-500 text-red-9' : 'text-gray-9',
        )}
      >
        {release.errorCount > 0 ? formatCount(release.errorCount) : '—'}
      </span>
      <span className="text-right font-mono text-11 text-gray-9">
        {release.sourcemapCount > 0
          ? `${formatCount(release.sourcemapCount)} (${formatBytes(release.sourcemapBytes)})`
          : '—'}
      </span>
      <span className="text-right font-mono text-11 text-gray-9">
        {release.lastSeen !== null ? relativeTime(release.lastSeen) : '—'}
      </span>
      <span className="flex justify-end">
        <button
          type="button"
          title="Delete release"
          aria-label={`Delete release ${release.release}`}
          onClick={() => setConfirming(true)}
          disabled={deleteRelease.isPending}
          className="flex size-6 items-center justify-center rounded-md text-gray-9 hover:bg-red-3 hover:text-red-9 disabled:pointer-events-none disabled:opacity-40"
        >
          ✕
        </button>
      </span>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete release"
        body={`Delete release "${release.release}"? This removes its signals, occurrences, and source maps.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteRelease.mutate({ id: appId, release: release.release })}
      />
    </div>
  );
}

/**
 * Releases card on the app detail screen (Task 6): a table of the app's
 * releases — signal/error counts, source-map count + size, last seen — with
 * a per-row delete action, confirmed via the shared `ConfirmDialog` primitive
 * (Task 7) rather than a plain `window.confirm()`. Not a typed-confirm like
 * Delete app/Rotate key — a single release is much lower blast radius than
 * the whole app, so a plain confirm dialog matches the CONSTRAINTS' "typed
 * confirm required for Delete app, Rotate key" scope.
 */
export function ReleasesCard({ appId }: { appId: number }) {
  const releasesQuery = useAppReleases(appId);
  const rows = releasesQuery.data ?? [];
  const isLoading = releasesQuery.isLoading;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-gray-6 bg-surface-raised">
      <div className="flex h-10.5 items-center gap-2.5 border-b border-gray-6 px-4">
        <span className="font-sans text-[13.5px] font-600 text-gray-12">Releases</span>
        {!isLoading && rows.length > 0 ? (
          <span className="font-mono text-11 text-gray-9">{rows.length}</span>
        ) : null}
      </div>
      <div
        role="row"
        className="grid h-7.5 items-center border-b border-gray-6 bg-gray-1 px-4 font-sans text-[10.5px] font-500 tracking-wide text-gray-11 uppercase"
        style={{ gridTemplateColumns: RELEASES_GRID_COLUMNS }}
      >
        <span>Release</span>
        <span className="text-right">Signals</span>
        <span className="text-right">Errors</span>
        <span className="text-right">Source maps</span>
        <span className="text-right">Last seen</span>
        <span />
      </div>
      {isLoading ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-gray-9">loading releases…</div>
      ) : isEmpty ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-gray-9">no releases yet</div>
      ) : (
        rows.map((release) => <ReleaseRow key={release.release} appId={appId} release={release} />)
      )}
    </div>
  );
}
