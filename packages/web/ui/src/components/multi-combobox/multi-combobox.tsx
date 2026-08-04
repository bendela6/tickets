import { useState } from 'react';
import { cn, TONE_HUE, type Tone } from '../../style';
import { fieldClass, fieldState } from '../field';
import { Icon, type IconSize } from '../icon';
import { Pill } from '../pill';
import { ComboboxList, type ComboOption } from '../combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import type { ControlSize } from '../control';

type MultiComboboxProps = {
  id?: string;
  options: ComboOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  size?: ControlSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  /** Max chips shown on the trigger before collapsing to +N. */
  maxChips?: number;
  className?: string;
};

// The trigger wraps its chips onto more rows as they accumulate, so each rung
// is a floor rather than a height — `h-auto` evicts the fixed height fieldClass
// contributes for the single-line controls.
const BOX: Record<ControlSize, string> = {
  sm: 'h-auto min-h-28 py-2',
  md: 'h-auto min-h-36 py-4',
  lg: 'h-auto min-h-44 py-6',
};

const CHEVRON: Record<ControlSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };

// The placeholder used to be a fixed `text-13/19`, so `size` moved the box and
// left the text behind. `md` is unchanged. The chips keep `text-12/17` at every
// rung deliberately — a chip is a label on a value, not the field's own prose,
// and it stays one step down so a full trigger does not read as a paragraph.
const TEXT: Record<ControlSize, string> = { sm: 'text-12/17', md: 'text-13/19', lg: 'text-14/20' };

export function MultiCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  tone,
  disabled,
  maxChips = 3,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
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
      {/* The whole shell is the trigger, not just the chevron. Now that the
          chips are read-only there is nothing inside it competing for a click,
          so a 12px glyph should not be the only way in — and the focus ring
          hangs off `focus` rather than `focus-within` because focus lands here
          rather than on some inner control. */}
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={placeholder}
          disabled={disabled}
          className={fieldClass({
            size,
            state: field.state,
            scale: field.scale,
            className: cn(
              'flex w-full items-center gap-6 px-10 text-left',
              'disabled:pointer-events-none disabled:opacity-50',
              BOX[size],
              className,
            ),
          })}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-6">
            {selectedOptions.length === 0 ? (
              <span className={cn('truncate font-sans text-gray-9', TEXT[size])}>
                {placeholder}
              </span>
            ) : null}
            {/* Chips are read-only. Deselecting happens in the popover, where
                the full set is visible and a mis-click is one click to undo —
                an X on the trigger removes a value from a list you cannot see,
                and puts a 12px target next to the control that opens it. */}
            {shown.map((option) => (
              <Pill
                key={option.value}
                tone={option.color ?? 'gray'}
                shape="round"
                label={option.label}
              />
            ))}
            {overflow > 0 ? (
              <span className="font-mono text-12/17 font-500 text-gray-11">+{overflow}</span>
            ) : null}
          </span>
          <Icon
            name="chevron-down"
            size={CHEVRON[size]}
            className="shrink-0 self-center text-gray-9"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <ComboboxList
          options={options}
          keepOpen
          isSelected={(candidate) => value.includes(candidate)}
          onPick={toggle}
          footer={
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  onChange(
                    options.filter((option) => !option.disabled).map((option) => option.value),
                  )
                }
                className="rounded-md px-4 font-sans text-12/17 font-500 text-indigo-9 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-md px-4 font-sans text-12/17 font-500 text-gray-11 hover:underline"
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
