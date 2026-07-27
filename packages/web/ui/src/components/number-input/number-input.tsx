import { cn, TONE_SCALE, type Tone } from '../../style';
import { fieldClass, type FieldSize } from '../field';

type NumberInputProps = {
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
  value,
  onChange,
  min,
  max,
  step = 1,
  size = 'md',
  tone = 'primary',
  disabled,
  placeholder,
  className,
}: NumberInputProps) {
  function nudge(delta: number) {
    const base = value ?? 0;
    onChange(clamp(base + delta, min, max));
  }

  return (
    <div
      className={fieldClass({
        size,
        scale: TONE_SCALE[tone],
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
        className="w-16 bg-transparent px-2 text-right font-sans text-ui text-gray-12 tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-gray-6">
        <button
          type="button"
          aria-label="Increment"
          tabIndex={-1}
          onClick={() => nudge(step)}
          className="flex flex-1 items-center px-1.5 text-[8px] text-gray-9 hover:bg-surface-inset hover:text-gray-12"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label="Decrement"
          tabIndex={-1}
          onClick={() => nudge(-step)}
          className="flex flex-1 items-center border-t border-gray-6 px-1.5 text-[8px] text-gray-9 hover:bg-surface-inset hover:text-gray-12"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
