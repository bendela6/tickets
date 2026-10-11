import { useState, type KeyboardEvent } from 'react';
import { cn } from '../../../../style';
import { fieldClass, fieldState } from '../../parts/field';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import { Chip } from '../../parts/chip';
import { ComboboxList } from '../../parts/combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../../../overlays/components/popover';
import {
  disabledTreatment,
  readOnlyFieldClass,
  type ControlProps,
  type ControlSize,
  type Option,
} from '../../contract';

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
  /** The choices, in the order the list shows them; with `onSearchChange`, the current matches. */
  options: Option[];
  /** Shown on the field while nothing is chosen, and the field's accessible name. */
  placeholder?: string;
  /** Max chips shown on the trigger before collapsing to +N. */
  maxChips?: number;
  /**
   * Search on the caller's side — a server, for a list too long to load whole.
   * Each keystroke is reported and `options` are taken as the matches; see
   * `ComboboxList.onQueryChange`. `options` must still hold the selected
   * values, or their chips have no label to show.
   */
  onSearchChange?: (query: string) => void;
  /** Options are in flight: the list draws skeleton rows rather than "nothing to pick". */
  loading?: boolean;
};

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

/** The keys a collapsed select-only combobox opens on (APG combobox pattern). */
const OPEN_KEYS = new Set(['Enter', ' ', 'ArrowDown']);

/**
 * Radix's trigger stamps `type="button"` for the <button> it expects to render,
 * and the child's props win the merge. Spread rather than written inline
 * because a div's props have no `type` to set.
 */
const NOT_A_BUTTON = { type: undefined };

/** Several choices from a list with a search box, shown on the field as chips. */
export function MultiCombobox({
  id,
  'aria-describedby': ariaDescribedBy,
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
  onSearchChange,
  loading,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  // Both close the affordance, for different reasons: disabled has no business
  // offering one at all, and read-only owes the value but not the edit. A chip
  // with no `onRemove` renders no target rather than a dead one.
  const locked = Boolean(disabled) || Boolean(readOnly);
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

  // A <div> has no native activation, so the keys a <button> answered for free
  // are spelled here. Only when the shell itself has focus: a chip's remove
  // target is a button of its own, and its Enter must not also open the list.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (locked || event.target !== event.currentTarget || !OPEN_KEYS.has(event.key)) {
      return;
    }
    // Space would scroll the page and ArrowDown would move it.
    event.preventDefault();
    setOpen(true);
  }

  return (
    <Popover
      // Refusing the open is one half of what makes read-only stick; the chips
      // dropping their remove target is the other. `open` is derived rather
      // than merely guarded so a field that turns read-only while its list is
      // open closes instead of staying editable. Disabled joins it because the
      // shell is no longer a <button>: nothing in the platform refuses a click
      // on a div, so this has to.
      open={open && !locked}
      onOpenChange={(next) => {
        if (!locked) {
          setOpen(next);
        }
      }}
    >
      {/* The whole shell is the trigger, not just the chevron — a 12px glyph
          should not be the only way in. It is a `role="combobox"` <div> rather
          than a <button> because the chips inside it carry buttons of their
          own (remove, +N), and a <button> may not contain interactive content:
          it is invalid HTML, React flags it, and a button's children are
          presentational to assistive tech, so a screen reader need never
          announce the remove targets at all. A remove target stops its click
          from reaching this shell; +N lets it through, since opening is what
          it is for.

          Unlike Combobox, role=combobox costs no name here: this trigger has
          always been named by `aria-label`, never by its content. The focus
          ring hangs off `focus` rather than `focus-within` so a focused remove
          target rings itself rather than the whole field. */}
      <PopoverTrigger asChild>
        <div
          id={id}
          aria-describedby={ariaDescribedBy}
          role="combobox"
          {...NOT_A_BUTTON}
          // Radix already says `aria-haspopup="dialog"` and `aria-expanded`,
          // and "dialog" is the honest word: the popup is a search box, a
          // listbox and a footer, not a bare listbox.
          aria-label={placeholder}
          // The words each state actually means, both legal on a combobox:
          // read-only keeps its tab stop and the value keeps its place in a
          // submission; disabled drops the tab stop.
          aria-readonly={readOnly ? true : undefined}
          aria-disabled={disabled ? true : undefined}
          aria-invalid={field.invalid || undefined}
          tabIndex={disabled ? undefined : 0}
          onKeyDown={onKeyDown}
          className={fieldClass({
            size,
            state: field.state,
            scale: field.scale,
            className: cn(
              // The pointer the base layer gives every <button>, which a div
              // does not inherit; without it the chip labels show an I-beam.
              'flex w-full cursor-pointer items-center gap-6 px-10',
              // `fieldClass` dims through the `disabled:` variant, which only an
              // element carrying the real attribute matches. A div never does.
              disabled && disabledTreatment,
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
              <span className={cn('text-gray-9 truncate font-sans')}>{placeholder}</span>
            ) : null}
            {/* Chips became removable here, reversing an earlier call. The
                objection then was that an X on the trigger "puts a 12px target
                next to the control that opens it" — which the Soft Fill chip
                answers directly by making the remove target the full square
                rather than the glyph, and by stopping its click from reaching
                the trigger underneath. */}
            {shown.map((option) => {
              return (
                <Chip
                  key={option.value}
                  label={option.label}
                  size={size}
                  tone={option.color ?? 'primary'}
                  onRemove={locked ? undefined : () => toggle(option.value)}
                />
              );
            })}
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
            className="text-gray-9 shrink-0 self-center"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <ComboboxList
          options={options}
          onQueryChange={onSearchChange}
          loading={loading}
          keepOpen
          isSelected={(candidate) => value.includes(candidate)}
          onPick={toggle}
          footer={
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  return commit(
                    options.filter((option) => !option.disabled).map((option) => option.value),
                  );
                }}
                className="rounded-6 text-12/17 font-500 text-indigo-9 px-4 font-sans hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                // `[]`, not null: empty is a value of the same kind, so a
                // consumer never has to spell two of them.
                onClick={() => commit([])}
                className="rounded-6 text-12/17 font-500 text-gray-11 px-4 font-sans hover:underline"
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
