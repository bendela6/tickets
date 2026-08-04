import { useState } from 'react';
import { cn, TONE_HUE, type Tone } from '../../style';
import { fieldClass, fieldState, type FieldSize } from '../field';
import { Icon, type IconSize } from '../icon';
import { Pill } from '../pill';
import { ComboboxList, type ComboOption } from '../combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

type ComboboxProps = {
  id?: string;
  options: ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  className?: string;
};

const PADDING: Record<FieldSize, string> = { sm: 'px-8', md: 'px-12', lg: 'px-14' };
const CHEVRON: Record<FieldSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };

// The trigger's label used to be a fixed `text-13/19`, so `size="lg"` grew the
// box by 8px and left the text where it was. The `md` rung is unchanged — 13/19
// is what the spec draws for a 36px combobox, and what this has always
// rendered — so only the two rungs that were inert move. Not shared with
// `fieldClass`: the spec puts a 36px input at 14px and a 36px combobox at 13px,
// so a single size-to-text table across all the controls would be wrong.
const TEXT: Record<FieldSize, string> = { sm: 'text-12/17', md: 'text-13/19', lg: 'text-14/20' };

export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  tone,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={fieldClass({
              size,
              state: field.state,
            scale: field.scale,
              className: cn(
                'flex w-full items-center justify-between gap-8 font-sans',
                'disabled:opacity-50 disabled:pointer-events-none',
                TEXT[size],
                PADDING[size],
                'pr-28',
              ),
            })}
          >
            {selected ? (
              selected.color ? (
                <Pill tone={selected.color} shape="round" label={selected.label} />
              ) : (
                <span className="truncate">{selected.label}</span>
              )
            ) : (
              <span className="truncate text-gray-9">{placeholder}</span>
            )}
            {/* Registry glyph, not a typed character: a text arrow renders at whatever
                size and weight the surrounding font gives it and sits off the
                optical centre, where the icon is drawn on a 16-unit grid and
                inherits the trigger's own colour. */}
            <Icon
              name="chevron-down"
              size={CHEVRON[size]}
              className="pointer-events-none absolute right-8 text-gray-9"
            />
          </button>
        </PopoverTrigger>
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
