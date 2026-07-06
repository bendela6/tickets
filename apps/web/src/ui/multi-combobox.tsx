import { useState } from 'react';
import { cn } from './cn';
import { ComboboxList, type ComboOption } from './combobox-list';
import { OptionChip } from './option-chip';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover';

type MultiComboboxProps = {
  options: ComboOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  size?: 'compact' | 'regular';
  disabled?: boolean;
  /** Max chips shown on the trigger before collapsing to +N. */
  maxChips?: number;
  className?: string;
};

export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'regular',
  disabled,
  maxChips = 3,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedOptions = value
    .map((entry) => options.find((option) => option.value === entry))
    .filter((option): option is ComboOption => Boolean(option));
  const shown = selectedOptions.slice(0, maxChips);
  const overflow = selectedOptions.length - shown.length;

  function toggle(entry: string) {
    onChange(value.includes(entry) ? value.filter((item) => item !== entry) : [...value, entry]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            'flex w-full flex-wrap items-center gap-1.5 rounded-ctrl border border-control bg-raised px-2',
            'focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-subtle',
            disabled && 'pointer-events-none opacity-50',
            size === 'compact' ? 'min-h-7 py-0.5' : 'min-h-9 py-1',
            className,
          )}
        >
          {shown.map((option) => (
            <span key={option.value} className="inline-flex items-center gap-1">
              <OptionChip color={option.color ?? 'gray'} label={option.label} />
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                onClick={() => toggle(option.value)}
                className="rounded-ctrl px-0.5 text-ink-3 hover:text-ink"
              >
                ×
              </button>
            </span>
          ))}
          {overflow > 0 ? <span className="font-sans text-meta text-ink-2">+{overflow}</span> : null}
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={placeholder}
              disabled={disabled}
              className="flex min-w-8 flex-1 items-center gap-2 self-stretch font-sans text-ui text-ink outline-none"
            >
              {selectedOptions.length === 0 ? (
                <span className="truncate text-ink-3">{placeholder}</span>
              ) : null}
              <span aria-hidden className="ml-auto text-ink-3">
                ▾
              </span>
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent className="p-0">
        <ComboboxList
          options={options}
          keepOpen
          isSelected={(candidate) => value.includes(candidate)}
          onPick={toggle}
          header={
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onChange(options.filter((option) => !option.disabled).map((option) => option.value))}
                className="rounded-ctrl px-1 font-sans text-meta text-accent hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-ctrl px-1 font-sans text-meta text-ink-2 hover:underline"
              >
                Clear ({value.length})
              </button>
            </div>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
