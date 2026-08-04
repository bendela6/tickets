import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { axis, cn, HUES, over, TONE_HUE, variants } from '../../style';
import { readOnlyMarkClass, type ControlProps } from '../control';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

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
      // 3 / 4 / 5px. The rung the slider was missing: `lg` existed on every
      // other control, and a slider beside a 44px field had nothing to match.
      options: { sm: 'h-3', md: 'h-4', lg: 'h-5' },
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
      // The row the thumb sits in — 16 / 20 / 24px, the same three-step ladder
      // the toggle marks use.
      options: { sm: 'h-16', md: 'h-20', lg: 'h-24' },
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

/**
 * The slider on the shared control contract, `ControlProps<number>`.
 *
 * `value` is a plain `number` rather than `number | null` on purpose: the thumb
 * has to be drawn somewhere, so "no value" would still render as a position and
 * lie about it. A field that can be empty resolves that one layer up, by not
 * rendering a slider or by naming a default.
 *
 * `label` stays REQUIRED and stays a prop, which is the one place this control
 * diverges from the text controls. Those can be named from outside by a
 * `<label for>`; a `div[role="slider"]` cannot, because `for` only binds to
 * labelable elements and a div is not one. The name has to come through the
 * component or it does not exist.
 */
type SliderProps = ControlProps<number> & {
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name. Required — a slider with no name is unusable by voice or screen reader. */
  label: string;
  /** Spoken form of the value where the number alone would mislead — `42%`, `1.5×`. */
  valueText?: string;
};

export function Slider({
  id,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  size = 'md',
  // A mark is always painted from some ramp — there is no neutral slider — so
  // this defaults where the bordered fields leave `tone` unset. See ControlProps.
  tone = 'primary',
  disabled = false,
  readOnly = false,
  valueText,
  className,
}: SliderProps) {
  const scale = TONE_HUE[tone];
  const trackRef = useRef<HTMLDivElement>(null);
  // Both input paths ask the same question, and both have to ask it: a
  // read-only slider keeps its tab stop, so the keyboard reaches it even
  // though `pointer-events-none` has already closed the pointer off.
  const locked = disabled || readOnly;
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
    if (locked) return;
    // Capture on the element that received the press, so a drag that leaves
    // the track keeps reporting instead of stopping at the edge.
    event.currentTarget.setPointerCapture(event.pointerId);
    emitFromPointer(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (locked || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    emitFromPointer(event.clientX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Returning before `preventDefault` rather than after: a locked slider owns
    // none of these keys, so PageDown should scroll the page as it would
    // anywhere else instead of being swallowed by a control that ignores it.
    if (locked) return;
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
      id={id}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      // HTML's `readonly` does not reach a range input, let alone a div, which
      // is exactly the gap ARIA fills for this role. Deliberately NOT
      // `aria-disabled`: the value still matters and the control still takes
      // focus, so a screen reader should read it, not skip it.
      aria-readonly={readOnly || undefined}
      aria-orientation="horizontal"
      // Read-only keeps its tab stop. Only `disabled` leaves the tab order.
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      // The visual half of read-only: the fill keeps its tone, because the
      // whole point is that the value stays readable, and what goes is the
      // affordance — no pointer target, no inviting cursor.
      className={rootClass({
        scale,
        size,
        className: cn(readOnly && readOnlyMarkClass, className),
      })}
    >
      {/* The track is where `cursor-pointer` lives, so it needs the override of
          its own — `variants` merges `className` last, which is what lets
          `cursor-default` evict it rather than sit beside it. */}
      <div
        ref={trackRef}
        className={trackClass({ size, className: readOnly ? 'cursor-default' : undefined })}
      >
        <div
          aria-hidden
          className={fillClass({ scale })}
          style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }}
        />
      </div>
    </div>
  );
}
