import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { axis, cn, focusRing, HUES, over, TONE_HUE, variants } from '../../../style';
import {
  CONTROL_LADDER,
  readOnlyMarkClass,
  type ControlProps,
  disabledAriaClass,
} from '../control';

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
  base: 'relative w-full cursor-pointer touch-none rounded-full bg-gray-5',
  config: {
    size: {
      default: 'md',
      // 4 / 6 / 8px — the design puts the track at 6 and the ladder steps
      // either side of it. Rung 5 is the floor a hovered field would use, which
      // is right for a groove: it reads as recessed without a border.
      options: { xs: 'h-4', md: 'h-6', lg: 'h-8' },
    },
  },
});

/**
 * The thumb — and it genuinely did not exist before. The component drew a track
 * and a fill and nothing else, so the value read solely from where the fill
 * happened to stop, while the source comments talked about "the row the thumb
 * sits in".
 *
 * It is the ONE control that keeps a visible border at rest. Every field under
 * Soft Fill rests with a transparent border and only colours it on focus; a
 * thumb is an object rather than a field, so a rim is what makes it read as a
 * thing sitting on the track rather than a gap in the fill.
 *
 * The rim is an arbitrary 1.5px for the same reason the old focus ring was:
 * `border-<number>` takes integers, so `border-1.5` compiles to nothing at all
 * and would leave the thumb rimless while every other class still looked right.
 */
const thumbClass = variants({
  base: [
    'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
    'rounded-full border-[1.5px] bg-surface-raised',
    'transition-[box-shadow] duration-120',
  ],
  config: {
    thumb: {
      default: 'on',
      // `group-focus-visible`, not `focus-visible`: focus lands on the root,
      // which owns the tab stop and the ARIA, and the ring belongs here.
      options: {
        on: over(SCALE, (tone) => [`border-${tone}-9`, focusRing(tone, 'group-focus-visible')]),
      },
    },
    size: {
      default: 'md',
      // The mark ladder, so a thumb and a checkbox beside it are the same object
      // size. Read from `CONTROL_LADDER` rather than restated — this comment
      // used to sit above a hand-written 14/16/20 that happened to agree.
      options: {
        xs: CONTROL_LADDER.xs.mark,
        md: CONTROL_LADDER.md.mark,
        lg: CONTROL_LADDER.lg.mark,
      },
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
  // `group` so the thumb can react to focus that lands here. The root keeps the
  // tab stop and the ARIA and gives up the ring: the design puts it on the
  // thumb, and a ring around the whole row pointed at the control rather than
  // at the value you were about to move.
  base: 'group flex w-full items-center rounded-md outline-none',
  config: {
    root: {
      default: 'on',
      options: {
        on: over(SCALE, () => [disabledAriaClass]),
      },
    },
    size: {
      default: 'md',
      // The row the thumb sits in — 16 / 20 / 24px, the same three-step ladder
      // the toggle marks use.
      options: { xs: 'h-16', md: 'h-20', lg: 'h-24' },
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
    // "← → moves one step, ⇧ ten" — the design says it, the shortcut list under
    // the specimen says it, and the component honoured neither: shift fell
    // through to a plain arrow, so the documented modifier did nothing at all.
    // Ten STEPS, not the Page keys' tenth-of-range: on a 0–10 slider those are
    // the same, and on a 0–1000 one they are not, and the shortcut promises the
    // step grid.
    const arrow = event.shiftKey ? step * 10 : step;
    const next: Record<string, number> = {
      ArrowLeft: value - arrow,
      ArrowDown: value - arrow,
      ArrowRight: value + arrow,
      ArrowUp: value + arrow,
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
        {/* `pointer-events-none` in the class: the track owns the press, and a
            thumb that swallowed it would make the one place you naturally aim
            the only place a click did nothing. */}
        <span
          aria-hidden
          data-thumb
          className={thumbClass({ scale, size })}
          style={{ left: `${Math.min(100, Math.max(0, fraction * 100))}%` }}
        />
      </div>
    </div>
  );
}
