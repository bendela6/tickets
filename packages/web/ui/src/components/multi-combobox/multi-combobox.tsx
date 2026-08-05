import { useState } from 'react';
import { cn } from '../../style';
import { fieldClass, fieldState } from '../field';
import { Icon, type IconSize } from '../icon';
import { Pill } from '../pill';
import { ComboboxList } from '../combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { readOnlyFieldClass, type ControlProps, type ControlSize, type Option } from '../control';

/**
 * The multi-select field. Answers to `ControlProps<string[]>` like every other
 * control in the package, so a caller that knows the value kind can drive it
 * without knowing which control it holds.
 *
 * `value` is `string[]` — never null. "Nothing selected" is the empty array, so
 * a caller never has to spell two empties, and every read (`value.length`,
 * `value.includes`) is safe without a guard.
 */
type MultiComboboxProps = ControlProps<string[]> & {
  options: Option[];
  placeholder?: string;
  /** Max chips shown on the trigger before collapsing to +N. */
  maxChips?: number;
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
  // No default. An unset tone is the resting neutral field, NOT a synonym for
  // `primary` — `fieldState` reads the difference and only a named tone paints
  // the border.
  tone,
  disabled,
  readOnly,
  maxChips = 3,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selectedOptions = value
    .map((entry) => options.find((option) => option.value === entry))
    .filter((option): option is Option => Boolean(option));
  const shown = selectedOptions.slice(0, maxChips);
  const overflow = selectedOptions.length - shown.length;

  // Read-only is not disabled: the trigger keeps its tab stop and the value
  // keeps its place in a submission, so nothing about the platform refuses a
  // write here — this does. One funnel, so a later affordance cannot be added
  // without the check.
  function commit(next: string[]) {
    if (readOnly) {
      return;
    }
    onChange(next);
  }

  function toggle(entry: string) {
    commit(value.includes(entry) ? value.filter((item) => item !== entry) : [...value, entry]);
  }

  return (
    <Popover
      // Refusing the open is what makes read-only stick. The chips carry no
      // remove affordance, so the list is the only way to change the value, and
      // a list that never opens is a value that cannot be edited. `open` is
      // derived rather than merely guarded so a field that turns read-only
      // while its list is open closes instead of staying editable.
      open={open && !readOnly}
      onOpenChange={(next) => {
        if (!readOnly) {
          setOpen(next);
        }
      }}
    >
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
          // Announced rather than enforced by the platform: `readonly` is not a
          // button attribute, and reaching for `disabled` instead would be
          // wrong twice over — it drops the tab stop, and it drops the value
          // from submission, which a field locked by permission still owes.
          // aria-disabled rather than aria-readonly: ARIA does not permit
          // the latter on a button, so it announced nothing. See Combobox for
          // why role=combobox was tried and rejected.
          aria-disabled={readOnly || undefined}
          disabled={disabled}
          className={fieldClass({
            size,
            state: field.state,
            scale: field.scale,
            className: cn(
              'flex w-full items-center gap-6 px-10 text-left',
              'disabled:pointer-events-none disabled:opacity-50',
              BOX[size],
              // Merged after the field's own border and fill so it wins them,
              // and before the caller's className so the caller still wins.
              // Deliberately not the disabled look: the text keeps full
              // contrast, because the value still matters.
              readOnly && readOnlyFieldClass,
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
                  commit(options.filter((option) => !option.disabled).map((option) => option.value))
                }
                className="rounded-md px-4 font-sans text-12/17 font-500 text-indigo-9 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                // `[]`, not null: empty is a value of the same kind, so a
                // consumer never has to spell two of them.
                onClick={() => commit([])}
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
