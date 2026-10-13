import { useState } from 'react';
import { cn } from '../../../../style';
import { fieldClass, fieldState } from '../../parts/field';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import { ComboboxList } from '../../parts/combobox-list';
import { triggerWidthClass } from '../../parts/popup/popup';
import { Popover, PopoverContent, PopoverTrigger } from '../../../overlays/components/popover';
import {
  readOnlyFieldClass,
  type ControlProps,
  type ControlSize,
  type Option,
  type OptionGroup,
} from '../../contract';

/**
 * The shared control contract at `string | null` — a single select can always
 * be empty — plus the extras only a popover select has.
 *
 * `id`, `value`, `onChange`, `size`, `tone`, `disabled`, `readOnly` and
 * `className` all arrive from `ControlProps` rather than being restated here,
 * which is what keeps `tone` free of a default: an unset tone is the resting
 * neutral field, not a quiet `'primary'`.
 */
type ComboboxProps = ControlProps<string | null> & {
  /** The choices, in the order the list shows them. */
  options: Option[];
  /** Shown on the field while `value` is `null`. */
  placeholder?: string;
  /**
   * Whether the open list offers a search box. Default true. Turn it off for a
   * short fixed set — over three options a search field is noise, and it costs
   * a keystroke to reach the list. Without it the field is a select: a
   * `combobox` the arrows open, and typing jumps to the option that starts
   * with what was typed.
   */
  searchable?: boolean;
  /**
   * Which group an option is in: the `key` of one of `groups`. With both
   * set, the list shows a heading over each group, in the order of `groups`,
   * and leaves out a group with no options. An option whose group isn't in
   * `groups` isn't shown.
   */
  groupOf?: (option: Option) => string;
  /** The groups' headings, in the order the list shows them. Used with `groupOf`. */
  groups?: OptionGroup[];
  /**
   * The accessible name, for a control with no visible label to point at it —
   * a filter under a column header, where the header is the only caption. A
   * control that has a `<label htmlFor>` should use that instead.
   */
  'aria-label'?: string;
};
const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

/** Keys on the closed field that open a list without search, besides Enter and Space. */
const OPEN_KEYS = new Set(['ArrowDown', 'ArrowUp']);

/**
 * One choice from a list, shown on the field as plain text. With a search box,
 * for a long list; with `searchable={false}`, a select for a short one.
 *
 * Both are one component on one listbox, `ComboboxList`, so the keys, the
 * groups and the disabled reasons can't come to differ between them.
 */
export function Combobox({
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  tone,
  disabled,
  readOnly,
  searchable = true,
  groupOf,
  groups,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  // The key typed on the closed field that opened the list, for the list's
  // typeahead to start from. Cleared whenever the list opens some other way.
  const [openedWith, setOpenedWith] = useState<string>();
  const field = fieldState(tone);
  // The field names the value from every option, whether the list shows it or not.
  const selected = options.find((option) => option.value === value) ?? null;
  // Without search the field is a select, and says so: a `combobox` whose
  // popup is a `listbox`, which is all that popup holds. With a search box it
  // stays a button; see the note on `aria-disabled`. Spread rather than set to
  // `undefined`, which would wipe Radix's own `aria-haspopup="dialog"`.
  const asSelect = searchable ? {} : { role: 'combobox', 'aria-haspopup': 'listbox' as const };

  /**
   * Without search the field answers the keys a select does. Enter and Space
   * are a button's own, so Radix opens on them; the arrows open too, and a
   * typed character opens the list at the first option it starts.
   */
  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (searchable || readOnly || open) {
      return;
    }
    const typesACharacter =
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey;
    if (OPEN_KEYS.has(event.key) || typesACharacter) {
      // ArrowDown would scroll the page.
      event.preventDefault();
      setOpenedWith(typesACharacter ? event.key : undefined);
      setOpen(true);
    }
  }

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
          setOpenedWith(undefined);
          setOpen(next);
        }
      }}
    >
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            aria-describedby={ariaDescribedBy}
            aria-label={ariaLabel}
            type="button"
            {...asSelect}
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
            // Without search the field is a `combobox` already, as `Select`
            // was, and keeps the same attribute so the two read alike.
            aria-disabled={readOnly ? true : undefined}
            aria-invalid={field.invalid || undefined}
            onKeyDown={onTriggerKeyDown}
            className={fieldClass({
              size,
              state: field.state,
              scale: field.scale,
              focus: 'focus-visible',
              className: cn(
                'flex w-full items-center justify-between gap-8 font-sans',
                !readOnly && 'pr-28',
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
                it: the tests all passed with a pill here. */}
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
              <span className="text-gray-9 truncate">{placeholder}</span>
            )}
            {/* Registry glyph, not a typed character: a text arrow renders at whatever
                size and weight the surrounding font gives it and sits off the
                optical centre, where the icon is drawn on a 16-unit grid and
                inherits the trigger's own colour. Dropped when read-only: a
                chevron promises a list that will not open. */}
            {readOnly ? null : (
              <Icon
                name="chevron-down"
                size={CHEVRON[size]}
                className="text-gray-9 pointer-events-none absolute right-8"
              />
            )}
          </button>
        </PopoverTrigger>
      </div>
      {/* Without search the list sits at the field's width, as a select's
          does. With a search box it keeps a width of its own, room to type. */}
      <PopoverContent className={cn('p-0', !searchable && triggerWidthClass)}>
        <ComboboxList
          options={options}
          searchable={searchable}
          groupOf={groupOf}
          groups={groups}
          openedWith={openedWith}
          className={searchable ? undefined : 'w-full'}
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
