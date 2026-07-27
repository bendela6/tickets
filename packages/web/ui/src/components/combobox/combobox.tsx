import { useState } from 'react';
import { cn } from '../../style/cn';
import { Pill } from '../pill';
import { ComboboxList, type ComboOption } from '../combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

type ComboboxProps = {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  size?: 'compact' | 'regular';
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'regular',
  disabled,
  clearable,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md border border-gray-7 bg-surface-raised font-sans text-ui text-gray-12',
              'hover:border-gray-9 focus:border-indigo-9 focus:outline-none focus:ring-[3px] focus:ring-indigo-3',
              'disabled:opacity-50 disabled:pointer-events-none',
              size === 'compact' ? 'h-7 px-2' : 'h-9 px-3',
              clearable && selected ? 'pr-14' : 'pr-8',
            )}
          >
            {selected ? (
              selected.color ? (
                <Pill tone={selected.color} shape="full" label={selected.label} />
              ) : (
                <span className="truncate">{selected.label}</span>
              )
            ) : (
              <span className="truncate text-gray-9">{placeholder}</span>
            )}
            <span
              aria-hidden
              className="pointer-events-none absolute right-2 text-[10px] text-gray-9"
            >
              ▾
            </span>
          </button>
        </PopoverTrigger>
        {clearable && selected ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded-md px-1 text-gray-9 hover:text-gray-12"
          >
            ×
          </button>
        ) : null}
      </div>
      <PopoverContent className="p-0">
        <ComboboxList
          options={options}
          isSelected={(candidate) => candidate === value}
          onPick={(picked) => {
            onChange(picked);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
