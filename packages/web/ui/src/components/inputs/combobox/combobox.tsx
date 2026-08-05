import { useState } from 'react';
import { cn } from '../../../style';
import { fieldClass, fieldState } from '../field';
import { Icon, type IconSize } from '../../icon';
import { ComboboxList } from '../combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';
import { readOnlyFieldClass, type ControlProps, type ControlSize, type Option } from '../control';

/**
 * The shared control contract at `string | null` — a single select can always
 * be empty — plus the three extras only a popover select has.
 *
 * `id`, `value`, `onChange`, `size`, `tone`, `disabled`, `readOnly` and
 * `className` all arrive from `ControlProps` rather than being restated here,
 * which is what keeps `tone` free of a default: an unset tone is the resting
 * neutral field, not a quiet `'primary'`.
 */
type ComboboxProps = ControlProps<string | null> & {
  options: Option[];
  placeholder?: string;
  /**
   * Whether the open list offers a search box. Default true. Turn it off for a
   * short fixed set — over three options a search field is noise, and it costs
   * a keystroke to reach the list.
   */
  searchable?: boolean;
};
const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  tone,
  disabled,
  readOnly,
  searchable = true,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Popover
      // Read-only is enforced at the popover, not at the trigger. The trigger
      // keeps its tab stop and its click handler — what it loses is the list,
      // and with the list unmounted there is nothing that can reach `onChange`.
      // `open && !readOnly` rather than the guard alone, so a field that turns
      // read-only while its list is open closes it instead of staying editable.
      open={open && !readOnly}
      onOpenChange={(next) => {
        if (!readOnly) {
          setOpen(next);
        }
      }}
    >
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            // `aria-disabled`, not `aria-readonly`, and not the `disabled`
            // attribute. Three-way choice, each rejected for a measured reason:
            //
            //   disabled       drops the tab stop AND the submitted value; a
            //                  field locked by permission still owes both.
            //   aria-readonly  the honest word, but ARIA does not permit it on
            //                  `button` — axe flags aria-allowed-attr and
            //                  assistive tech ignores it, so it announces
            //                  nothing at all.
            //   role=combobox  would make aria-readonly legal, and was tried.
            //                  But a combobox takes its name from an author,
            //                  where a button takes it from its content — and
            //                  only 2 of 30 call sites label these controls, so
            //                  28 would have silently lost their accessible
            //                  name. A worse regression than the bug.
            //
            // So: the attribute a button does permit, which announces the
            // trigger as not-operable while keeping focus and submission. The
            // proper fix is to label these controls and then adopt
            // `role="combobox"`; until then this is the honest second best.
            aria-disabled={readOnly || undefined}
            className={fieldClass({
              size,
              state: field.state,
              scale: field.scale,
              className: cn(
                'flex w-full items-center justify-between gap-8 font-sans',
                'disabled:opacity-50 disabled:pointer-events-none',
                'pr-28',
                // Last, so it wins the border and the ground it is overriding.
                // Deliberately not the disabled look — the text keeps full
                // contrast, because a value you may not edit is still a value
                // you have to be able to read.
                readOnly && readOnlyFieldClass,
              ),
            })}
          >
            {/* Plain text, never a chip. Chips say "one of several things I am
                holding" and belong only to the multi-value controls; a combobox
                holds exactly one. A coloured option keeps a leading DOT,
                because the colour is data — a status has one and dropping it
                loses the only thing the chip was carrying. Found by looking at
                the gallery: the tests all passed with a pill here. */}
            {selected ? (
              <span className="flex min-w-0 items-center gap-8">
                {selected.color ? (
                  <span
                    aria-hidden
                    className={cn('size-8 shrink-0 rounded-full', `bg-${selected.color}-9`)}
                  />
                ) : null}
                <span className="truncate">{selected.label}</span>
              </span>
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
          searchable={searchable}
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
