import { cn } from './cn';

type RadioOption = { value: string; label: string; disabled?: boolean };

type RadioGroupProps = {
  name: string;
  label: string;
  value: string;
  options: RadioOption[];
  onValueChange: (value: string) => void;
  className?: string;
};

export function RadioGroup({ name, label, value, options, onValueChange, className }: RadioGroupProps) {
  return (
    <fieldset className={cn('m-0 flex items-center gap-4 border-0 p-0', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink has-disabled:cursor-not-allowed"
        >
          <span className="relative inline-flex size-4 shrink-0">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onValueChange(option.value)}
              className={cn(
                'peer m-0 size-4 shrink-0 appearance-none rounded-full border-[1.5px] border-control bg-raised transition-colors',
                'checked:border-accent',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
                'disabled:cursor-not-allowed disabled:border-hairline disabled:bg-inset',
              )}
            />
            {/* Inner dot as an overlay (not a thick border) so selected reads as a
                1.5px accent ring around an 8px accent dot, per the spec. */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 hidden size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent peer-checked:block"
            />
          </span>
          <span className={cn(option.disabled && 'text-ink-3')}>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
