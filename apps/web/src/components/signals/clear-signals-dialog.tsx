import { useEffect, useState } from 'react';
import type { ClearSignalsFilters, SignalsAppRow } from '../../api/signals/signals-api';
import { useAppReleases, useClearAppSignals } from '../../api/signals/use-signals';
import { Button } from '../../ui/button';
import { DialogFooter } from '@tickets/ui/dialog-footer';
import { DialogContent, DialogRoot, DialogTitle } from '../../ui/dialog';

type ManagedApp = Pick<SignalsAppRow, 'id' | 'name' | 'slug'>;
type Mode = 'all' | 'older-than' | 'release';
type OlderThanDays = 7 | 14 | 30;

const OLDER_THAN_OPTIONS: { days: OlderThanDays; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Derives the wire filters from the mode picker — All -> {}, Older-than -> a
// `before` cutoff computed from "now", Release -> {release}. Pure function of
// the current mode so switching back to "All" can't leak a stale before/release.
function computeFilters(mode: Mode, olderThanDays: OlderThanDays, release: string): ClearSignalsFilters {
  if (mode === 'older-than') {
    return { before: new Date(Date.now() - olderThanDays * MS_PER_DAY).toISOString() };
  }
  if (mode === 'release') {
    return release === '' ? {} : { release };
  }
  return {};
}

function scopeLabel(mode: Mode, olderThanDays: OlderThanDays, release: string): string {
  if (mode === 'older-than') {
    return `every signal older than ${olderThanDays} days`;
  }
  if (mode === 'release') {
    return release === '' ? 'a release — pick one below' : `every signal from release "${release}"`;
  }
  return 'every signal for this app';
}

/**
 * Clear-signals dialog: a mode picker (All / Older than N days / a specific
 * Release, releases populated from useAppReleases) that shows the resolved
 * scope before confirming — DELETE /apps/:id/signals also prunes any issue
 * left with zero signals in the same transaction (app-signals.routes.ts), so
 * the post-clear panel surfaces both counts.
 */
export function ClearSignalsDialog({
  app,
  open,
  onOpenChange,
}: {
  app: ManagedApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const releasesQuery = useAppReleases(app.id);
  const clearSignals = useClearAppSignals();
  const [mode, setMode] = useState<Mode>('all');
  const [olderThanDays, setOlderThanDays] = useState<OlderThanDays>(7);
  const [release, setRelease] = useState('');
  const [result, setResult] = useState<{ deletedSignals: number; prunedIssues: number } | null>(null);

  useEffect(() => {
    if (open) {
      setMode('all');
      setOlderThanDays(7);
      setRelease('');
      setResult(null);
      clearSignals.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app.id]);

  function change(next: boolean) {
    onOpenChange(next);
  }

  async function confirm() {
    if (mode === 'release' && release === '') {
      return;
    }
    try {
      const outcome = await clearSignals.mutateAsync({
        id: app.id,
        filters: computeFilters(mode, olderThanDays, release),
      });
      setResult(outcome);
    } catch {
      // swallow — clearSignals.isError/.error drives the inline error below.
    }
  }

  const releases = releasesQuery.data ?? [];
  const confirmDisabled = mode === 'release' && release === '';

  return (
    <DialogRoot open={open} onOpenChange={change}>
      <DialogContent>
        {result === null ? (
          <>
            <DialogTitle>Clear signals</DialogTitle>
            <p className="mt-1.5 font-sans text-meta text-ink-2">
              Removes signals for <strong className="font-medium text-ink">{app.slug}</strong> and prunes
              any issue left with none. This cannot be undone.
            </p>

            <div className="mt-4 flex flex-col gap-2.5">
              <label className="flex items-center gap-2 font-sans text-ui text-ink">
                <input
                  type="radio"
                  name="clear-signals-mode"
                  checked={mode === 'all'}
                  onChange={() => setMode('all')}
                />
                All signals
              </label>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 font-sans text-ui text-ink">
                  <input
                    type="radio"
                    name="clear-signals-mode"
                    checked={mode === 'older-than'}
                    onChange={() => setMode('older-than')}
                  />
                  Older than
                </label>
                <select
                  aria-label="Older than"
                  value={olderThanDays}
                  disabled={mode !== 'older-than'}
                  onChange={(event) => setOlderThanDays(Number(event.target.value) as OlderThanDays)}
                  className="h-7 rounded-[6px] border border-control bg-raised px-1.5 font-sans text-[12.5px] text-ink disabled:text-ink-3"
                >
                  {OLDER_THAN_OPTIONS.map((option) => (
                    <option key={option.days} value={option.days}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 font-sans text-ui text-ink">
                  <input
                    type="radio"
                    name="clear-signals-mode"
                    checked={mode === 'release'}
                    onChange={() => setMode('release')}
                  />
                  Release
                </label>
                <select
                  aria-label="Release"
                  value={release}
                  disabled={mode !== 'release'}
                  onChange={(event) => setRelease(event.target.value)}
                  className="h-7 min-w-0 flex-1 rounded-[6px] border border-control bg-raised px-1.5 font-sans text-[12.5px] text-ink disabled:text-ink-3"
                >
                  <option value="">Choose a release…</option>
                  {releases.map((candidate) => (
                    <option key={candidate.release} value={candidate.release}>
                      {candidate.release}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 rounded-[8px] border border-hairline bg-inset px-3 py-2 font-mono text-[11.5px] text-ink-2">
              Will clear: {scopeLabel(mode, olderThanDays, release)}
            </div>

            {clearSignals.isError ? (
              <p className="mt-2 font-sans text-meta text-danger">
                {clearSignals.error instanceof Error ? clearSignals.error.message : 'Could not clear signals'}
              </p>
            ) : null}

            <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Cancel</Button>}>
              <Button
                variant="destructive"
                disabled={confirmDisabled}
                loading={clearSignals.isPending}
                onClick={() => void confirm()}
              >
                Clear signals
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogTitle>Signals cleared</DialogTitle>
            <p className="mt-1.5 font-sans text-meta text-ink-2">
              Removed {result.deletedSignals} signal{result.deletedSignals === 1 ? '' : 's'}
              {result.prunedIssues > 0
                ? ` and pruned ${result.prunedIssues} issue${result.prunedIssues === 1 ? '' : 's'} left with none`
                : ''}
              .
            </p>
            <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Close</Button>} />
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
