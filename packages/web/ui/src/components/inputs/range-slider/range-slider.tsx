import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn, cursorRing, focusRing, TONE_HUE } from '../../../style';
import { readOnlyMarkClass, type ControlProps } from '../control';
import { quantise } from '../slider';

/** Which end is being moved. Named rather than indexed so the clamping below
 *  reads as what it is. */
type End = 'low' | 'high';

export type RangeSliderProps = Omit<ControlProps<[number, number]>, 'value' | 'onChange'> & {
  value: [number, number];
  onChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name. Each thumb gets its own derived from this. */
  label: string;
};

/**
 * Two thumbs, a low bound and a high one.
 *
 * The thumbs NEVER swap. Dragging low past high pins it at high rather than
 * trading places: a range that reordered itself under the pointer means the
 * thumb you grabbed is no longer the thumb you are moving, and every subsequent
 * pixel goes the wrong way.
 *
 * When they collide, the one you are holding stays on top — otherwise a range
 * closed to zero traps the lower thumb underneath and cannot be reopened.
 */
export function RangeSlider({
  id,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  size = 'md',
  tone = 'primary',
  disabled = false,
  readOnly = false,
  className,
}: RangeSliderProps) {
  const hue = TONE_HUE[tone];
  const trackRef = useRef<HTMLDivElement>(null);
  const [holding, setHolding] = useState<End | null>(null);
  const locked = disabled || readOnly;
  const [low, high] = value;
  const span = max - min;
  const fraction = (n: number) => (span === 0 ? 0 : ((n - min) / span) * 100);

  const commit = useCallback(
    (end: End, raw: number) => {
      const snapped = quantise(raw, min, max, step);
      // The pin. Never a swap.
      const next: [number, number] =
        end === 'low' ? [Math.min(snapped, high), high] : [low, Math.max(snapped, low)];
      if (next[0] !== low || next[1] !== high) onChange(next);
    },
    [high, low, max, min, onChange, step],
  );

  /** Whichever end the press was closer to — the only sensible reading of a
   *  click on bare track, and it is also what makes a collided pair separable:
   *  clicking either side picks the end that can move that way. */
  function nearestEnd(position: number): End {
    return Math.abs(position - low) <= Math.abs(position - high) ? 'low' : 'high';
  }

  function positionFrom(clientX: number): number | null {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return min + ((clientX - box.left) / box.width) * span;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (locked) return;
    const position = positionFrom(event.clientX);
    if (position === null) return;
    const end = nearestEnd(position);
    setHolding(end);
    event.currentTarget.setPointerCapture(event.pointerId);
    commit(end, position);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (locked || !holding || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const position = positionFrom(event.clientX);
    if (position !== null) commit(holding, position);
  }

  function onKeyDown(end: End, event: KeyboardEvent) {
    if (locked) return;
    const arrow = event.shiftKey ? step * 10 : step;
    const current = end === 'low' ? low : high;
    const moves: Record<string, number> = {
      ArrowLeft: current - arrow,
      ArrowDown: current - arrow,
      ArrowRight: current + arrow,
      ArrowUp: current + arrow,
      Home: min,
      End: max,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    commit(end, target);
  }

  const thumb = (end: End) => {
    const at = end === 'low' ? low : high;
    return (
      <span
        role="slider"
        aria-label={`${label} ${end === 'low' ? 'lower' : 'upper'} bound`}
        aria-valuemin={end === 'low' ? min : low}
        aria-valuemax={end === 'low' ? high : max}
        aria-valuenow={at}
        aria-disabled={disabled || undefined}
        aria-readonly={readOnly || undefined}
        tabIndex={disabled ? -1 : 0}
        data-end={end}
        onKeyDown={(event) => onKeyDown(end, event)}
        onFocus={() => setHolding(end)}
        style={{ left: `${fraction(at)}%` }}
        className={cn(
          'absolute top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full',
          'border-[1.5px] bg-surface-raised outline-none',
          `border-${hue}-9`,
          focusRing(hue, 'focus-visible', 'outward'),
          // The held thumb sits on top. Without this a range closed to zero
          // traps whichever thumb rendered first and cannot be reopened.
          holding === end ? 'z-20' : 'z-10',
          holding === end && cursorRing(hue),
        )}
      />
    );
  };

  return (
    <div
      id={id}
      className={cn('flex w-full items-center', disabled && 'opacity-50', locked && readOnlyMarkClass, className)}
    >
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setHolding(null)}
        className={cn(
          'relative h-6 w-full rounded-full bg-gray-5',
          locked ? 'cursor-default' : 'cursor-pointer',
        )}
      >
        {/* Only the span BETWEEN the thumbs is filled — a range's meaning is the
            distance, not the distance from zero. */}
        <span
          aria-hidden
          className={cn('absolute inset-y-0 rounded-full', `bg-${hue}-9`)}
          style={{ left: `${fraction(low)}%`, width: `${Math.max(0, fraction(high) - fraction(low))}%` }}
        />
        {thumb('low')}
        {thumb('high')}
      </div>
    </div>
  );
}
