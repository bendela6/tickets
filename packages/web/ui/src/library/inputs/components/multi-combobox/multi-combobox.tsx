import { useState } from 'react';
import { cn } from '../../../../style';
import { fieldClass, fieldState } from '../../parts/field';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import { Chip } from '../../parts/chip';
import { ComboboxList } from '../../parts/combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../../../overlays/components/popover';
import { readOnlyFieldClass, type ControlProps, type ControlSize, type Option } from '../../contract';

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

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

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
  // Both close the affordance, for different reasons: disabled has no business
  // offering one at all, and read-only owes the value but not the edit. A chip
  // with no `onRemove` renders no target rather than a dead one.
  const locked = disabled || readOnly;
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
      // Refusing the open is one half of what makes read-only stick; the chips
      // dropping their remove target is the other. `open` is derived rather
      // than merely guarded so a field that turns read-only while its list is
      // open closes instead of staying editable.
      open={open && !readOnly}
      onOpenChange={(next) => {
        if (!readOnly) {
          setOpen(next);
        }
      }}
    >
      {/* The whole shell is the trigger, not just the chevron — a 12px glyph
          should not be the only way in. The chips inside it are now targets of
          their own, which works because each stops its click from reaching this
          button. The focus ring hangs off `focus` rather than `focus-within`
          because focus lands here rather than on some inner control. */}
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
              <span className={cn('truncate font-sans text-gray-9')}>
                {placeholder}
              </span>
            ) : null}
            {/* Chips became removable here, reversing an earlier call. The
                objection then was that an X on the trigger "puts a 12px target
                next to the control that opens it" — which the Soft Fill chip
                answers directly by making the remove target the full square
                rather than the glyph, and by stopping its click from reaching
                the trigger underneath. */}
            {shown.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                size={size}
                tone={option.color ?? 'primary'}
                onRemove={locked ? undefined : () => toggle(option.value)}
              />
            ))}
            {/* "+N is a target, not a label." As a bare span it stood for
                values that no keyboard could reach — the only way to see them
                was a mouse click on the trigger. */}
            {overflow > 0 ? (
              <Chip
                label={`+${overflow}`}
                size={size}
                tone="neutral"
                onClick={locked ? undefined : () => setOpen(true)}
              />
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
                className="rounded-6 px-4 font-sans text-12/17 font-500 text-indigo-9 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                // `[]`, not null: empty is a value of the same kind, so a
                // consumer never has to spell two of them.
                onClick={() => commit([])}
                className="rounded-6 px-4 font-sans text-12/17 font-500 text-gray-11 hover:underline"
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
