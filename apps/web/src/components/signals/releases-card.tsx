import type { AppReleaseRow } from '../../api/signals/signals-api';
import { useAppReleases, useDeleteRelease } from '../../api/signals/use-signals';
import { cn } from '@tickets/ui/cn';
import { formatBytes, formatCount, relativeTime } from './format';

// release · signals · errors · source maps (count + bytes) · last seen · delete.
const RELEASES_GRID_COLUMNS = 'minmax(0,1fr) 76px 76px 150px 84px 36px';

function ReleaseRow({ appId, release }: { appId: number; release: AppReleaseRow }) {
  const deleteRelease = useDeleteRelease();

  function handleDelete() {
    // Lightweight window.confirm for this task — Task 7 replaces this with
    // the richer confirm-dialog treatment shared by rotate/clear/delete-app.
    const confirmed = window.confirm(
      `Delete release "${release.release}"? This removes its signals, occurrences, and source maps.`,
    );
    if (!confirmed) {
      return;
    }
    deleteRelease.mutate({ id: appId, release: release.release });
  }

  return (
    <div
      role="row"
      className="grid h-8.5 items-center border-b border-hairline px-4 last:border-b-0"
      style={{ gridTemplateColumns: RELEASES_GRID_COLUMNS }}
    >
      <span className="truncate font-mono text-[11.5px] font-medium text-ink">{release.release}</span>
      <span className="text-right font-mono text-[11.5px] text-ink">{formatCount(release.signalCount)}</span>
      <span
        className={cn(
          'text-right font-mono text-[11.5px]',
          release.errorCount > 0 ? 'font-medium text-danger' : 'text-ink-3',
        )}
      >
        {release.errorCount > 0 ? formatCount(release.errorCount) : '—'}
      </span>
      <span className="text-right font-mono text-[11px] text-ink-3">
        {release.sourcemapCount > 0
          ? `${formatCount(release.sourcemapCount)} (${formatBytes(release.sourcemapBytes)})`
          : '—'}
      </span>
      <span className="text-right font-mono text-[11px] text-ink-3">
        {release.lastSeen !== null ? relativeTime(release.lastSeen) : '—'}
      </span>
      <span className="flex justify-end">
        <button
          type="button"
          title="Delete release"
          aria-label={`Delete release ${release.release}`}
          onClick={handleDelete}
          disabled={deleteRelease.isPending}
          className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-danger-subtle hover:text-danger disabled:pointer-events-none disabled:opacity-40"
        >
          ✕
        </button>
      </span>
    </div>
  );
}

/**
 * Releases card on the app detail screen (Task 6): a table of the app's
 * releases — signal/error counts, source-map count + size, last seen — with
 * a per-row delete action. The delete itself is functional here (mutation +
 * a plain confirm()); Task 7 swaps the confirm() for a proper dialog as part
 * of the shared destructive-action treatment.
 */
export function ReleasesCard({ appId }: { appId: number }) {
  const releasesQuery = useAppReleases(appId);
  const rows = releasesQuery.data ?? [];
  const isLoading = releasesQuery.isLoading;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-hairline bg-raised">
      <div className="flex h-10.5 items-center gap-2.5 border-b border-hairline px-4">
        <span className="font-sans text-[13.5px] font-semibold text-ink">Releases</span>
        {!isLoading && rows.length > 0 ? (
          <span className="font-mono text-[11px] text-ink-3">{rows.length}</span>
        ) : null}
      </div>
      <div
        role="row"
        className="grid h-7.5 items-center border-b border-hairline bg-app px-4 font-sans text-[10.5px] font-medium tracking-wide text-ink-2 uppercase"
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
        <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">loading releases…</div>
      ) : isEmpty ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">no releases yet</div>
      ) : (
        rows.map((release) => <ReleaseRow key={release.release} appId={appId} release={release} />)
      )}
    </div>
  );
}
