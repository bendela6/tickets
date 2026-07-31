import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { axis, cn, HUE_TONES, over, TONE_SCALE, variants, type Tone } from '../../style';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUE_TONES, 'indigo');

export type SliderSize = 'sm' | 'md';

/**
 * A single-value slider.
 *
 * Built on a div with `role="slider"` rather than `<input type="range">`: a
 * native range's track and thumb are only reachable through vendor
 * pseudo-elements (`::-webkit-slider-thumb`, `::-moz-range-thumb`), which no
 * utility class can target, so a tokenised range would need a hand-written
 * stylesheet per engine. The ARIA contract — `aria-valuemin`/`max`/`now`, the
 * arrow/Page/Home/End keys, a focusable tabindex — is what makes it a slider,
 * and it is spelled out below rather than inherited.
 */
const trackClass = variants({
  base: 'relative w-full cursor-pointer touch-none rounded-full bg-surface-inset',
  config: {
    size: {
      default: 'md',
      options: { sm: 'h-0.75', md: 'h-1' },
    },
  },
});

const fillClass = variants({
  base: 'absolute inset-y-0 left-0 rounded-full',
  config: {
    fill: {
      default: 'on',
      options: { on: over(SCALE, (tone) => `bg-${tone}-9`) },
    },
  },
});

const rootClass = variants({
  base: 'flex w-full items-center rounded-md outline-none',
  config: {
    root: {
      default: 'on',
      options: {
        on: over(SCALE, (tone) => [
          `focus-visible:ring-3 focus-visible:ring-${tone}-3`,
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        ]),
      },
    },
    size: {
      default: 'md',
      options: { sm: 'h-4', md: 'h-5' },
    },
  },
});

/**
 * Snap a raw value onto the step grid, anchored at `min` so a range that does
 * not start at zero still lands on reachable values, then clamp.
 */
export function quantise(raw: number, min: number, max: number, step: number): number {
  if (step <= 0) return Math.min(max, Math.max(min, raw));
  const snapped = min + Math.round((raw - min) / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  // Re-round to the step's own decimal places: 0.1 steps accumulate binary
  // float error otherwise, and the readout beside a slider shows every digit.
  const places = (String(step).split('.')[1] ?? '').length;
  return Number(clamped.toFixed(places));
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  size = 'md',
  tone = 'primary',
  disabled = false,
  valueText,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name. Required — a slider with no name is unusable by voice or screen reader. */
  label: string;
  size?: SliderSize;
  /** Which ramp the fill and focus ring paint from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  /** Spoken form of the value where the number alone would mislead — `42%`, `1.5×`. */
  valueText?: string;
  className?: string;
}) {
  const scale = TONE_SCALE[tone];
  const trackRef = useRef<HTMLDivElement>(null);
  const span = max - min;
  const fraction = span === 0 ? 0 : (value - min) / span;

  const emitFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const box = track.getBoundingClientRect();
      if (box.width === 0) return;
      onChange(quantise(min + ((clientX - box.left) / box.width) * (max - min), min, max, step));
    },
    [max, min, onChange, step],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Capture on the element that received the press, so a drag that leaves
    // the track keeps reporting instead of stopping at the edge.
    event.currentTarget.setPointerCapture(event.pointerId);
    emitFromPointer(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    emitFromPointer(event.clientX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const jump = span === 0 ? step : Math.max(step, span / 10);
    const next: Record<string, number> = {
      ArrowLeft: value - step,
      ArrowDown: value - step,
      ArrowRight: value + step,
      ArrowUp: value + step,
      PageDown: value - jump,
      PageUp: value + jump,
      Home: min,
      End: max,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onChange(quantise(target, min, max, step));
  };

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      aria-orientation="horizontal"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={rootClass({ scale, size, className })}
    >
      <div ref={trackRef} className={trackClass({ size })}>
        <div
          aria-hidden
          className={fillClass({ scale })}
          style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }}
        />
      </div>
    </div>
  );
}
