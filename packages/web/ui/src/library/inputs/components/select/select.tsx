import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../../style';
import { Icon, type IconSize } from '../../../icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize, type Option } from '../../contract';
import { fieldClass, fieldState } from '../../parts/field';
import { OptionRow } from '../../parts/option-row';
import { Popup } from '../../parts/popup';

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

export type SelectProps = ControlProps<string | null> & {
  options: Option[];
  placeholder?: string;
};

/**
 * One choice from a short list, shown as PLAIN TEXT.
 *
 * The distinction from Combobox is the whole reason this exists. Combobox
 * filters as you type and is right for a long list; Select just opens. And
 * until now every single-select in the product rendered its value as a chip,
 * which is wrong for most of them — a chip says "one of several things I am
 * holding", and a select holds exactly one. The design is explicit: "Select
 * shows its value as plain text — never a chip."
 *
 * A leading dot IS allowed when the option carries a colour, "because that is
 * data, not decoration" — a status or a label has a colour that means
 * something, and dropping it loses information the chip was at least carrying.
 *
 * `tone` has no default: an unset tone is the resting neutral field, not a
 * quiet `primary`. See `ControlProps`.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  /**
   * The keyboard cursor, which is NOT the selection — the same split OptionRow
   * draws as two channels. It starts on the selected row so opening a list and
   * pressing Enter is a no-op rather than a silent change of value.
   */
  const [cursor, setCursor] = useState(() => Math.max(0, selectedIndex));
  const listRef = useRef<HTMLDivElement>(null);

  // Opening re-seats the cursor on whatever is currently selected. Without this
  // it would still be wherever it was left last time the list was open, which
  // is the value the user has since changed away from.
  useEffect(() => {
    if (open) setCursor(Math.max(0, selectedIndex));
  }, [open, selectedIndex]);

  /** The next row that can actually be picked. A cursor resting on a disabled
   *  row means Enter does nothing, and silence is the worst answer to a key. */
  function nextEnabled(from: number, step: number): number {
    for (let i = from + step; i >= 0 && i < options.length; i += step) {
      if (!options[i]?.disabled) return i;
    }
    return from;
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((index) => nextEnabled(index, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((index) => nextEnabled(index, -1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setCursor(nextEnabled(-1, 1));
    } else if (event.key === 'End') {
      event.preventDefault();
      setCursor(nextEnabled(options.length, -1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(cursor);
    }
  }

  const trigger = (
    <button
      id={id}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      // aria-disabled rather than aria-readonly: ARIA does not permit the
      // latter on a button. Same call as Combobox and DatePicker.
      aria-disabled={readOnly || undefined}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        size,
        state: field.state,
        scale: field.scale,
        focus: 'focus-visible',
        className: cn(
          'flex w-full items-center justify-between gap-8 font-sans',
          selected ? 'text-gray-12' : 'text-gray-9',
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      <span className="flex min-w-0 items-center gap-8">
        {/* Only when the option is a coloured thing. A dot on every row would
            be decoration; a dot on a status is the status. */}
        {selected?.color ? (
          <span
            aria-hidden
            className={cn('size-8 shrink-0 rounded-full', `bg-${selected.color}-9`)}
          />
        ) : null}
        <span className="truncate">{selected ? selected.label : placeholder}</span>
      </span>
      {/* Dropped when read-only: a chevron promises a list that will not open. */}
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="shrink-0 text-gray-9" />
      )}
    </button>
  );

  return (
    <Popup
      open={open}
      // Read-only refuses to OPEN and keeps everything else. `disabled` would
      // take the tab stop and the value with it.
      onOpenChange={(next) => setOpen(readOnly ? false : next)}
      trigger={trigger}
      // A select's list belongs at the trigger's width — unlike a calendar,
      // whose grid has a width of its own.
      matchTriggerWidth
    >
      <div
        ref={listRef}
        role="listbox"
        tabIndex={-1}
        aria-activedescendant={options[cursor] ? `${id ?? 'select'}-opt-${options[cursor].value}` : undefined}
        onKeyDown={onKeyDown}
        // Focus lands here on open so the arrows work without a further click.
        autoFocus
        className="flex max-h-288 flex-col gap-2 overflow-y-auto outline-none"
      >
        {options.length === 0 ? (
          <p className="px-9 py-12 text-center font-sans text-12 text-gray-9">Nothing to choose</p>
        ) : null}
        {options.map((option, index) => (
          <OptionRow
            key={option.value}
            id={`${id ?? 'select'}-opt-${option.value}`}
            selected={option.value === value}
            cursor={index === cursor}
            disabled={option.disabled}
            onPick={() => commit(index)}
            leading={
              option.color ? (
                <span
                  aria-hidden
                  className={cn('size-8 shrink-0 rounded-full', `bg-${option.color}-9`)}
                />
              ) : undefined
            }
          >
            {option.label}
          </OptionRow>
        ))}
      </div>
    </Popup>
  );
}
