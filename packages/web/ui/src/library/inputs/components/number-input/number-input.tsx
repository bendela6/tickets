import { forwardRef } from 'react';
import { cn } from '../../../../style';
import { fieldClass, fieldState } from '../../parts/field';
import { Icon } from '../../../icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize, disabledTreatment } from '../../contract';

/**
 * The shared control contract at `T = number | null`, plus the four props only
 * a numeric field has.
 *
 * `null` is not a stand-in for zero: an estimate nobody has given yet and an
 * estimate of 0 are different facts, and the field has to be able to hold the
 * first without inventing the second.
 */
type NumberInputProps = ControlProps<number | null> & {
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (min !== undefined) {
    next = Math.max(min, next);
  }
  if (max !== undefined) {
    next = Math.min(max, next);
  }
  return next;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    id,
    value,
    onChange,
    min,
    max,
    step = 1,
    size = 'md',
    tone,
    disabled,
    readOnly,
    placeholder,
    className,
  },
  ref,
) {
  const field = fieldState(tone);

  // Neither state may move the value, so neither gets the stepper's hover
  // affordance either. They are NOT the same treatment otherwise: disabled
  // dims the whole control and drops its tab stop, read-only keeps both.
  const inert = disabled === true || readOnly === true;

  function nudge(delta: number) {
    // HTML's `readonly` reaches the typing path and nothing else — the steppers
    // are buttons, and would happily rewrite a field the user may not edit.
    if (inert) return;
    const base = value ?? 0;
    onChange(clamp(base + delta, min, max));
  }

  /**
   * At a bound the step is DIMMED, not removed — the design is explicit about
   * it, and the reason is that a stepper column which loses an arrow changes
   * height and shifts the other one under a pointer that was about to click it.
   * Dimming says "this way is spent" while the geometry holds still.
   *
   * An unset value counts as being at neither bound: there is nothing to be at
   * the floor of yet, and dimming both arrows on an empty field would suggest
   * the control is broken rather than empty.
   */
  const atFloor = value !== null && min !== undefined && value <= min;
  const atCeiling = value !== null && max !== undefined && value >= max;

  const stepper = cn(
    'flex flex-1 items-center px-6 text-gray-9',
    !inert && 'hover:bg-surface-inset hover:text-gray-12',
  );

  return (
    <div
      className={fieldClass({
        size,
        state: field.state,
        scale: field.scale,
        // Focus lands on the inner <input>, never on this wrapper, so the ring
        // has to hang off focus-within.
        focus: 'focus-within',
        className: cn(
          // `flex w-full`, not `inline-flex`: every other control is block-level
          // and fills its column, and a stepper that shrank to its content sat
          // at a different width from the field above it in the same form.
          //
          // `pr-0` gives up the ladder's right padding so the stepper column can
          // reach the edge. With it, the seam and the arrows floated 12px inside
          // the field and read as though they belonged to something else.
          'flex w-full items-stretch pr-0',
          disabled && disabledTreatment,
          // Composed here rather than through Tailwind's `read-only:` variant:
          // that variant compiles to the CSS `:read-only` pseudo-class, which
          // matches every element that is not user-editable — this wrapper
          // `div` included, where it would be permanently on. See control.ts.
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      <input
        ref={ref}
        id={id}
        type="number"
        role="spinbutton"
        inputMode="numeric"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        // The real attribute, not `aria-readonly`: this is a text-entry control,
        // and `<input>` honours `readonly` natively — it keeps the tab stop and
        // keeps the value in form submission, which `disabled` would drop.
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? null : Number(raw));
        }}
        className={cn(
          // Grows rather than sitting at a fixed 64px, which is what pushes the
          // stepper column to the right edge instead of leaving it wherever a
          // short value happened to end.
          'min-w-0 flex-1 bg-transparent pr-8 text-right font-sans text-gray-12 tabular-nums outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
        )}
      />
      {/* The seam is a 1px rung-7 line, per the design — a Soft Fill control has
          no rim of its own, so a divider is the one place the fill treatment
          still needs a drawn edge. */}
      {/* Dropped when read-only, the same call DatePicker's chevron makes: a
          stepper promises an edit the field will not honour, and leaving a dead
          affordance in place is the trap the design names for read-only —
          "a glyph cannot fix an affordance you left in place". */}
      {readOnly ? null : (
      <div className="flex flex-col border-l-1 border-gray-7">
        <button
          type="button"
          aria-label="Increment"
          tabIndex={-1}
          disabled={inert || atCeiling}
          onClick={() => nudge(step)}
          className={cn(stepper, atCeiling && 'opacity-40')}
        >
          <Icon name="chevron-up" size="2xs" />
        </button>
        <button
          type="button"
          aria-label="Decrement"
          tabIndex={-1}
          disabled={inert || atFloor}
          onClick={() => nudge(-step)}
          className={cn(stepper, 'border-t-1 border-gray-7', atFloor && 'opacity-40')}
        >
          <Icon name="chevron-down" size="2xs" />
        </button>
      </div>
      )}
    </div>
  );
});
