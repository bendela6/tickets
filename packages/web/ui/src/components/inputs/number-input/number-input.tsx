import { forwardRef } from 'react';
import { cn } from '../../../style';
import { fieldClass, fieldState } from '../field';
import { Icon } from '../../icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../control';

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

// The digits used to be a fixed `text-13/19`, so `size` moved the box and the
// stepper buttons while the number itself stayed put. `md` is unchanged.
const TEXT: Record<ControlSize, string> = { xs: 'text-12/17', md: 'text-13/19', lg: 'text-14/20' };

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
          'inline-flex items-stretch',
          disabled && 'pointer-events-none opacity-50',
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
          'w-64 bg-transparent px-8 text-right font-sans text-gray-12 tabular-nums outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
          TEXT[size],
        )}
      />
      <div className="flex flex-col border-l-1 border-gray-6">
        <button
          type="button"
          aria-label="Increment"
          tabIndex={-1}
          disabled={inert}
          onClick={() => nudge(step)}
          className={stepper}
        >
          <Icon name="chevron-up" size="2xs" />
        </button>
        <button
          type="button"
          aria-label="Decrement"
          tabIndex={-1}
          disabled={inert}
          onClick={() => nudge(-step)}
          className={cn(stepper, 'border-t-1 border-gray-6')}
        >
          <Icon name="chevron-down" size="2xs" />
        </button>
      </div>
    </div>
  );
});
