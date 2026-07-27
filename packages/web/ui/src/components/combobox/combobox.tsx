import { useState } from 'react';
import { cn, TONE_SCALE, type Tone } from '../../style';
import { fieldClass, type FieldSize } from '../field';
import { Pill } from '../pill';
import { ComboboxList, type ComboOption } from '../combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

type ComboboxProps = {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

const PADDING: Record<FieldSize, string> = { sm: 'px-2', md: 'px-3', lg: 'px-3.5' };

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  tone = 'primary',
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
            className={fieldClass({
              size,
              scale: TONE_SCALE[tone],
              className: cn(
                'flex w-full items-center justify-between gap-2 font-sans text-ui',
                'disabled:opacity-50 disabled:pointer-events-none',
                PADDING[size],
                clearable && selected ? 'pr-14' : 'pr-8',
              ),
            })}
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
