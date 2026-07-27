import { useState } from 'react';
import { cn, TONE_SCALE, type Tone } from '../../style';
import { fieldClass, type FieldSize } from '../field';
import { Icon, type IconSize } from '../icon';
import { Pill } from '../pill';
import { ComboboxList, type ComboOption } from '../combobox-list';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../popover';

type MultiComboboxProps = {
  options: ComboOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  size?: FieldSize;
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
const BOX: Record<FieldSize, string> = {
  sm: 'h-auto min-h-7 py-0.5',
  md: 'h-auto min-h-9 py-1',
  lg: 'h-auto min-h-11 py-1.5',
};

const CHEVRON: Record<FieldSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };

export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  tone = 'primary',
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
          className={fieldClass({
            size,
            scale: TONE_SCALE[tone],
            // Focus lands on the inner search input, not on this wrapper.
            focus: 'focus-within',
            className: cn(
              'flex w-full items-center gap-1.5 px-2.5',
              disabled && 'pointer-events-none opacity-50',
              BOX[size],
              className,
            ),
          })}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {selectedOptions.length === 0 ? (
              <span className="truncate font-sans text-ui text-gray-9">{placeholder}</span>
            ) : null}
            {shown.map((option) => (
              <span key={option.value} className="inline-flex items-center gap-1">
                <Pill tone={option.color ?? 'gray'} shape="round" label={option.label} />
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  onClick={() => toggle(option.value)}
                  className="rounded-md px-0.5 text-gray-9 hover:text-gray-12"
                >
                  <Icon name="x" size="2xs" />
                </button>
              </span>
            ))}
            {overflow > 0 ? (
              <span className="font-mono text-meta font-medium text-gray-11">+{overflow}</span>
            ) : null}
          </div>
          {/* Clearing every chip at once used to require opening the popover
              and hitting "Clear (n)" — one click on a control that is already
              on screen, versus three. Only shown when there is something to
              clear, so the trigger does not gain a permanently dead slot. */}
          {value.length > 0 && !disabled ? (
            <button
              type="button"
              aria-label="Clear all"
              onClick={() => onChange([])}
              className="flex shrink-0 items-center self-center rounded-md px-0.5 text-gray-9 outline-none hover:text-gray-12"
            >
              <Icon name="x" size={CHEVRON[size]} />
            </button>
          ) : null}
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={placeholder}
              disabled={disabled}
              className="flex shrink-0 items-center self-center font-sans text-gray-9 outline-none"
            >
              <Icon name="chevron-down" size={CHEVRON[size]} />
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
          footer={
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  onChange(
                    options.filter((option) => !option.disabled).map((option) => option.value),
                  )
                }
                className="rounded-md px-1 font-sans text-meta font-medium text-indigo-9 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-md px-1 font-sans text-meta font-medium text-gray-11 hover:underline"
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
