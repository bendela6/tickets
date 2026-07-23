import { cn } from '@tickets/ui/cn';

type NumberInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: 'compact' | 'regular';
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
  size = 'regular',
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
      className={cn(
        'inline-flex items-stretch rounded-ctrl border border-control bg-raised',
        'focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-subtle',
        disabled && 'pointer-events-none opacity-50',
        size === 'compact' ? 'h-7' : 'h-9',
        className,
      )}
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
        className="w-16 bg-transparent px-2 text-right font-sans text-ui text-ink tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-hairline">
        <button
          type="button"
          aria-label="Increment"
          tabIndex={-1}
          onClick={() => nudge(step)}
          className="flex flex-1 items-center px-1.5 text-[8px] text-ink-3 hover:bg-inset hover:text-ink"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label="Decrement"
          tabIndex={-1}
          onClick={() => nudge(-step)}
          className="flex flex-1 items-center border-t border-hairline px-1.5 text-[8px] text-ink-3 hover:bg-inset hover:text-ink"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
