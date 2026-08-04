import { cn, TONE_HUE, type Tone } from '../../style';
import { fieldClass, fieldState, type FieldSize } from '../field';
import { Icon } from '../icon';

type NumberInputProps = {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

// The digits used to be a fixed `text-13/19`, so `size` moved the box and the
// stepper buttons while the number itself stayed put. `md` is unchanged.
const TEXT: Record<FieldSize, string> = { sm: 'text-12/17', md: 'text-13/19', lg: 'text-14/20' };

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

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  size = 'md',
  tone,
  disabled,
  placeholder,
  className,
}: NumberInputProps) {
  const field = fieldState(tone);

  function nudge(delta: number) {
    const base = value ?? 0;
    onChange(clamp(base + delta, min, max));
  }

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
          className,
        ),
      })}
    >
      <input
        id={id}
        type="number"
        role="spinbutton"
        inputMode="numeric"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? null : Number(raw));
        }}
        className={cn(
          'w-16 bg-transparent px-2 text-right font-sans text-gray-12 tabular-nums outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
          TEXT[size],
        )}
      />
      <div className="flex flex-col border-l-1 border-gray-6">
        <button
          type="button"
          aria-label="Increment"
          tabIndex={-1}
          onClick={() => nudge(step)}
          className="flex flex-1 items-center px-1.5 text-gray-9 hover:bg-surface-inset hover:text-gray-12"
        >
          <Icon name="chevron-up" size="2xs" />
        </button>
        <button
          type="button"
          aria-label="Decrement"
          tabIndex={-1}
          onClick={() => nudge(-step)}
          className="flex flex-1 items-center border-t-1 border-gray-6 px-1.5 text-gray-9 hover:bg-surface-inset hover:text-gray-12"
        >
          <Icon name="chevron-down" size="2xs" />
        </button>
      </div>
    </div>
  );
}
