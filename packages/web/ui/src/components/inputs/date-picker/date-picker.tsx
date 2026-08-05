import { useState } from 'react';
import { cn } from '../../../style';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../control';
import { fieldClass, fieldState } from '../field';
import { Icon, type IconSize } from '../../icon';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';
import { formatExact } from '../../relative-date';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * The calendar-day part of an ISO string: `2026-07-09T00:00:00Z` → `2026-07-09`.
 *
 * Every comparison in here runs on this form. A zero-padded ISO day sorts
 * lexicographically, so `<` and `>` on the strings ARE date order — no `Date`
 * has to be constructed, and no local zone gets a chance to move the day.
 */
function isoDay(value: string) {
  return value.slice(0, 10);
}

function parseParts(value: string | null): { year: number; month: number; day: number } | null {
  if (!value) {
    return null;
  }
  const match = isoDay(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

/**
 * The date field, driven by the shared control contract: `value` is the ISO
 * string the API stores and `onChange` hands one back, so the same FormConfig
 * that drives a Combobox drives this.
 *
 * `tone` deliberately has no default — an unset tone is the resting neutral
 * field, not a synonym for `primary`. See `ControlProps`.
 */
export type DatePickerProps = ControlProps<string | null> & {
  placeholder?: string;
  /**
   * Earliest / latest selectable day, ISO `yyyy-mm-dd` — the same
   * representation `value` carries, so a caller can hand either prop the
   * string it got out of the other.
   *
   * A string rather than a `Date` because a calendar day has neither a time
   * nor a zone and a `Date` has both: `new Date('2026-07-09')` west of
   * Greenwich is the evening of the 8th, which is how a bound quietly goes off
   * by one. A full timestamp is accepted here too — only the leading day is
   * read.
   *
   * Out-of-range days are still drawn, so the shape of the month is intact;
   * they are simply not selectable. A `value` already outside the range is
   * shown as-is: the bound governs what can be picked, not what can be held.
   */
  min?: string;
  max?: string;
};

const BOX: Record<ControlSize, string> = {
  sm: 'px-9 text-13',
  md: 'px-12 text-14',
  lg: 'px-14 text-15',
};

const CHEVRON: Record<ControlSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Set date…',
  size = 'md',
  tone,
  disabled,
  readOnly,
  min,
  max,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selected = parseParts(value);
  const today = new Date();
  const [view, setView] = useState(() => ({
    year: selected?.year ?? today.getUTCFullYear(),
    month: selected?.month ?? today.getUTCMonth(),
  }));

  const startWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_unused, index) => index + 1),
  ];

  function shiftMonth(delta: number) {
    setView((current) => {
      const next = current.month + delta;
      return { year: current.year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });
  }

  function outOfRange(iso: string) {
    return (min !== undefined && iso < isoDay(min)) || (max !== undefined && iso > isoDay(max));
  }

  // What the control emits: a UTC midnight timestamp whose leading ten
  // characters are the day that was clicked. Both `date` and `datetime` fields
  // store it, and `parseParts` reads it back, so a value round-trips.
  function commit(parts: { year: number; month: number; day: number }) {
    const iso = `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}`;
    if (outOfRange(iso)) {
      return;
    }
    onChange(`${iso}T00:00:00Z`);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      // Read-only refuses to OPEN; it does not drop the trigger. The button
      // keeps its tab stop and its value — `disabled` would take both, and a
      // field locked by permission still owes its value to the form. See
      // `ControlProps.readOnly`.
      onOpenChange={(next) => setOpen(readOnly ? false : next)}
    >
      <PopoverTrigger asChild>
        <button
          // The label's target. Without it a `<FieldLabel htmlFor>` points at
          // nothing and the field cannot be named at all — no `getByLabelText`,
          // and no click-the-label-to-focus.
          id={id}
          type="button"
          disabled={disabled}
          // aria-disabled rather than aria-readonly: ARIA does not permit
          // the latter on a button. See Combobox for the full reasoning.
          aria-disabled={readOnly || undefined}
          className={fieldClass({
            size,
            state: field.state,
            scale: field.scale,
            className: cn(
              'flex w-full items-center justify-between gap-8 font-sans',
              'disabled:pointer-events-none disabled:opacity-50',
              BOX[size],
              selected ? 'text-gray-12' : 'text-gray-9',
              // Ground and affordances change; the text keeps full contrast,
              // because the whole point is that the value stays readable.
              readOnly && readOnlyFieldClass,
              className,
            ),
          })}
        >
          {value ? formatExact(value) : placeholder}
          {/* Dropped when read-only: a chevron promises a calendar that is not
              going to open. */}
          {readOnly ? null : (
            <Icon name="chevron-down" size={CHEVRON[size]} className="text-gray-9" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-236 rounded-xl p-12">
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-24 w-24 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset"
          >
            <Icon name="chevron-left" size="sm" />
          </button>
          <span className="font-sans text-13/19 font-600 text-gray-12">
            {MONTH_NAMES[view.month]} {view.year}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="inline-flex h-24 w-24 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset"
          >
            <Icon name="chevron-right" size="sm" />
          </button>
        </div>
        <div className="grid grid-cols-[repeat(7,28px)] justify-center gap-2">
          {WEEKDAYS.map((weekday, index) => (
            <div key={index} className="text-center font-mono text-10 font-500 text-gray-9">
              {weekday}
            </div>
          ))}
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`blank-${index}`} />;
            }
            const isSelected =
              selected?.year === view.year &&
              selected?.month === view.month &&
              selected?.day === day;
            const isToday =
              today.getUTCFullYear() === view.year &&
              today.getUTCMonth() === view.month &&
              today.getUTCDate() === day;
            const blocked = outOfRange(`${view.year}-${pad(view.month + 1)}-${pad(day)}`);
            return (
              <button
                key={day}
                type="button"
                // A day outside the bounds is genuinely not for you — unlike
                // the field itself, it holds no value, so `disabled` is the
                // right refusal here and drops it from the tab order too.
                disabled={blocked}
                onClick={() => commit({ year: view.year, month: view.month, day })}
                className={cn(
                  'flex h-28 w-28 items-center justify-center rounded-md font-sans text-12',
                  isSelected
                    ? 'bg-indigo-9 text-indigo-contrast'
                    : isToday
                      ? 'text-gray-12 ring-1 ring-surface-inset ring-indigo-9 hover:bg-surface-inset'
                      : 'text-gray-12 hover:bg-surface-inset',
                  blocked && 'cursor-default opacity-40 hover:bg-transparent',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
        <input
          aria-label="Enter date"
          type="text"
          defaultValue={value ? isoDay(value) : ''}
          placeholder="YYYY-MM-DD"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }
            const parts = parseParts((event.target as HTMLInputElement).value);
            if (parts) {
              // Same `commit`, so a typed date obeys min/max exactly as a
              // clicked one does — a second code path here is how a bound gets
              // enforced in the grid and nowhere else.
              commit(parts);
            }
          }}
          className={fieldClass({
            size: 'sm',
            state: field.state,
            scale: field.scale,
            className: 'mt-10 w-full px-9 font-mono text-12/17 text-gray-9',
          })}
        />
      </PopoverContent>
    </Popover>
  );
}
