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
          className="inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onValueChange(option.value)}
            className={cn(
              'size-4 shrink-0 appearance-none rounded-full border border-control bg-raised transition-colors',
              'checked:border-[5px] checked:border-accent',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
          <span className={cn(option.disabled && 'opacity-50')}>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
