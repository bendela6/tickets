import { cn } from '@tickets/ui';

/** How much of the cycle the band trails behind the playhead. */
const BAND = 0.24;

/**
 * The scrubber. One control, two kinds of time.
 *
 * **Finite** — a transition — is a solid rail with rounded caps and a fill
 * anchored to a hard left origin, because it begins and ends.
 *
 * **Continuous** — a sustained state — has neither, so the rail loses its caps
 * and becomes dashed, and the fill becomes a band that trails the playhead and
 * wraps across the seam instead of resetting. That wrap is the whole point:
 * a fill that snapped back to zero would assert an end the state does not have.
 */
export function Track({
  progress,
  looping,
  disabled,
  onSeek,
}: {
  /** 0–1: transition progress, or position around the loop. */
  progress: number;
  looping: boolean;
  disabled: boolean;
  onSeek: (value: number) => void;
}) {
  const bandStart = progress - BAND;
  const leading = bandStart >= 0 ? { left: bandStart, width: BAND } : { left: 0, width: progress };
  const wrapped = bandStart >= 0 ? null : { left: 1 + bandStart, width: -bandStart };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    onSeek(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)));
  };

  return (
    <div
      role="slider"
      aria-label={looping ? 'Loop position' : 'Transition progress'}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(progress.toFixed(2))}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={seek}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.05));
        if (event.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.05));
        if (event.key === 'Home') onSeek(0);
        if (event.key === 'End') onSeek(1);
      }}
      className={cn(
        'relative flex h-6 min-w-14 flex-1 items-center outline-none',
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-x-0 h-0.75', !looping && !disabled && 'rounded-sm bg-gray-6')}
        style={
          looping || disabled
            ? {
                backgroundImage:
                  'repeating-linear-gradient(to right, var(--color-gray-6) 0 5px, transparent 5px 9px)',
              }
            : undefined
        }
      />

      {!looping && !disabled ? (
        <span
          aria-hidden
          className="absolute left-0 h-0.75 rounded-sm bg-indigo-9"
          style={{ width: `${progress * 100}%` }}
        />
      ) : null}

      {looping ? (
        <>
          <span
            aria-hidden
            className="absolute h-0.75 rounded-sm bg-indigo-9"
            style={{ left: `${leading.left * 100}%`, width: `${leading.width * 100}%` }}
          />
          {wrapped ? (
            <span
              aria-hidden
              className="absolute h-0.75 rounded-sm bg-indigo-9"
              style={{ left: `${wrapped.left * 100}%`, width: `${wrapped.width * 100}%` }}
            />
          ) : null}
        </>
      ) : null}

      {!disabled ? (
        <span
          aria-hidden
          className="absolute size-2.75 -translate-x-1/2 rounded-full bg-indigo-9 ring-2 ring-surface-field"
          style={{ left: `${progress * 100}%` }}
        />
      ) : null}
    </div>
  );
}
