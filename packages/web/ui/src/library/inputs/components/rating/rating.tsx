import { useState } from 'react';
import { cn, focusRing, TONE_HUE } from '../../../../style';
import {
  CONTROL_LADDER,
  disabledTreatment,
  readOnlyMarkClass,
  type ControlProps,
} from '../../contract';

export type RatingProps = ControlProps<number> & {
  /** How many marks. Five unless a scale says otherwise. */
  max?: number;
  /** Accessible name. Required — a rating with no name is a row of shapes. */
  label: string;
  /** Shown after the marks as `3/5`. */
  showValue?: boolean;
};

/**
 * A small fixed scale, picked by clicking one of N marks.
 *
 * Two rungs of the ramp do the work, and the split is the design's: a hover
 * PREVIEW paints rung 8, a committed value paints rung 9. Without two rungs a
 * preview is indistinguishable from the value, so you cannot tell whether
 * moving the mouse has already changed something — the single most common
 * complaint about star ratings.
 *
 * `value` is a plain number where 0 means unrated, not `null`. The marks have
 * to be drawn either way, so "no value" is a position on the scale rather than
 * an absence, and a nullable type would have every caller writing `?? 0`.
 */
export function Rating({
  id,
  value,
  onChange,
  max = 5,
  label,
  showValue = false,
  size = 'md',
  // A mark is always painted from some ramp — there is no neutral rating — so
  // this defaults where the bordered fields leave `tone` unset. See ControlProps.
  tone = 'primary',
  disabled = false,
  readOnly = false,
  className,
}: RatingProps) {
  const hue = TONE_HUE[tone];
  const rung = CONTROL_LADDER[size];
  const [preview, setPreview] = useState<number | null>(null);
  const locked = disabled || readOnly;
  // What is drawn: the preview while one exists, otherwise the value.
  const shown = preview ?? value;

  function commit(next: number) {
    if (locked) return;
    // Clicking the mark you are already on clears the rating. Otherwise a
    // one-star rating is the only one that cannot be taken back.
    onChange(next === value ? 0 : next);
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      onMouseLeave={() => setPreview(null)}
      className={cn(
        'flex items-center',
        rung.gap,
        // Two states, two treatments — this used to apply only the read-only
        // one on `locked`, so a DISABLED rating never dimmed and read as an
        // ordinary printed value. Read-only means "real data you may read";
        // disabled means "unavailable". They must not look the same.
        disabled && disabledTreatment,
        locked && readOnlyMarkClass,
        className,
      )}
    >
      {Array.from({ length: max }, (_unused, index) => {
        const position = index + 1;
        const filled = position <= shown;
        return (
          <button
            key={position}
            type="button"
            role="radio"
            aria-checked={position === value}
            aria-label={`${position} of ${max}`}
            // Read-only keeps its tab stop; only `disabled` leaves the order.
            tabIndex={disabled ? -1 : 0}
            disabled={disabled}
            onMouseEnter={() => !locked && setPreview(position)}
            onFocus={() => !locked && setPreview(position)}
            onBlur={() => setPreview(null)}
            onClick={() => commit(position)}
            className={cn(
              'rounded-control-xs leading-none transition-colors',
              rung.text,
              focusRing(hue, 'focus-visible', 'inward'),
              filled
                ? // Rung 8 for a preview, 9 for the committed value — the one
                  // pair that tells you whether the mouse has already changed
                  // something or is only offering to.
                  preview !== null
                  ? `text-${hue}-8`
                  : `text-${hue}-9`
                : 'text-gray-7',
            )}
          >
            <span aria-hidden>{filled ? '★' : '☆'}</span>
          </button>
        );
      })}
      {showValue ? (
        <span className="ml-4 font-mono text-11 tabular-nums text-gray-11">
          {value > 0 ? `${value}/${max}` : 'Not rated'}
        </span>
      ) : null}
    </div>
  );
}
