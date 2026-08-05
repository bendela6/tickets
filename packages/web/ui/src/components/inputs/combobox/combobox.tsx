import { useState } from 'react';
import { cn } from '../../../style';
import { fieldClass, fieldState } from '../field';
import { Icon, type IconSize } from '../../icon';
import { Pill } from '../../pill';
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

const PADDING: Record<ControlSize, string> = { sm: 'px-8', md: 'px-12', lg: 'px-14' };
const CHEVRON: Record<ControlSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };

// The trigger's label used to be a fixed `text-13/19`, so `size="lg"` grew the
// box by 8px and left the text where it was. The `md` rung is unchanged — 13/19
// is what the spec draws for a 36px combobox, and what this has always
// rendered — so only the two rungs that were inert move. Not shared with
// `fieldClass`: the spec puts a 36px input at 14px and a 36px combobox at 13px,
// so a single size-to-text table across all the controls would be wrong.
const TEXT: Record<ControlSize, string> = { sm: 'text-12/17', md: 'text-13/19', lg: 'text-14/20' };

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
                TEXT[size],
                PADDING[size],
                'pr-28',
                // Last, so it wins the border and the ground it is overriding.
                // Deliberately not the disabled look — the text keeps full
                // contrast, because a value you may not edit is still a value
                // you have to be able to read.
                readOnly && readOnlyFieldClass,
              ),
            })}
          >
            {selected ? (
              selected.color ? (
                // `min-w-0` is load-bearing: a Pill is an unshrinkable flex
                // item by default, so a long label pushed the chevron out of
                // the trigger instead of being cut. The pill may shrink, and
                // `truncate` on the label is what then ellipsises it.
                <Pill
                  tone={selected.color}
                  shape="round"
                  className="min-w-0"
                  label={<span className="truncate">{selected.label}</span>}
                />
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
