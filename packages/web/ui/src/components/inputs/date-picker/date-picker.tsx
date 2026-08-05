import { useEffect, useRef, useState } from 'react';
import { cn, cursorRing, focusRing } from '../../../style';
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

type Parts = { year: number; month: number; day: number };

/**
 * Move a calendar day by `n` days, rolling over months and years.
 *
 * Through `Date.UTC` rather than by arithmetic on `day`: adding 7 to the 28th
 * of a February has to know which February, and only the calendar does. UTC
 * throughout for the same reason `isoDay` uses it — a local zone west of
 * Greenwich turns midnight into the previous evening.
 */
function addDays(parts: Parts, n: number): Parts {
  const moved = new Date(Date.UTC(parts.year, parts.month, parts.day + n));
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth(), day: moved.getUTCDate() };
}

/** Same, by whole months, clamping onto the shorter month — 31 Jan + 1 month is
 *  28 Feb, not 3 March, which is what plain arithmetic would give. */
function addMonths(parts: Parts, n: number): Parts {
  const target = parts.month + n;
  const year = parts.year + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { year, month, day: Math.min(parts.day, lastDay) };
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

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

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

  /**
   * The keyboard cursor — where the arrows are, which is NOT what is selected.
   *
   * Two separate facts, and the design draws them as two channels: selection is
   * a solid rung-9 tile, the cursor is the inward ring. Collapsing them would
   * mean arrowing across a month committed a value on every keypress.
   *
   * The grid is a roving tabindex: only the cursor day is tabbable, so Tab
   * enters and leaves the calendar in one press instead of walking 31 buttons.
   */
  const [cursor, setCursor] = useState<Parts>(
    () => selected ?? { year: view.year, month: view.month, day: today.getUTCDate() },
  );
  // Focus only follows the cursor when a KEY moved it. Without this the grid
  // would grab focus the moment the popover opened, taking it from the trigger
  // that is still announcing itself.
  const navigating = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navigating.current) return;
    navigating.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-cursor="true"]')?.focus();
  }, [cursor]);

  function moveCursor(next: Parts) {
    navigating.current = true;
    setCursor(next);
    // Arrowing past either edge of the month pulls the view along, so the
    // cursor is never on a day that is not being drawn.
    if (next.year !== view.year || next.month !== view.month) {
      setView({ year: next.year, month: next.month });
    }
  }

  function onGridKeyDown(event: React.KeyboardEvent) {
    // The design's shortcut line: "↑↓ week". Page keys move a month, matching
    // every other calendar, and Home/End bracket the month rather than the week
    // — a week already costs one arrow press either way.
    const moves: Record<string, () => Parts> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => ({ ...cursor, day: 1 }),
      End: () => ({
        ...cursor,
        day: new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate(),
      }),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveCursor(move());
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(cursor);
    }
  }

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
              selected ? 'text-gray-12' : 'text-gray-9',
              // Ground and affordances change; the text keeps full contrast,
              // because the whole point is that the value stays readable.
              readOnly && readOnlyFieldClass,
              className,
            ),
          })}
        >
          {/* Monospace, per the design — a column of dates in a table has to
              align on its digits, and a proportional face makes every row a
              different width. The PLACEHOLDER stays proportional: it is prose,
              not a date, and setting it in mono would read as a value. */}
          {value ? (
            <span className="font-mono tabular-nums">{formatExact(value)}</span>
          ) : (
            placeholder
          )}
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
            <Icon name="chevron-left" size="xs" />
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
            <Icon name="chevron-right" size="xs" />
          </button>
        </div>
        <div
          ref={gridRef}
          role="grid"
          onKeyDown={onGridKeyDown}
          className="grid grid-cols-[repeat(7,28px)] justify-center gap-2"
        >
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
            const isCursor =
              cursor.year === view.year && cursor.month === view.month && cursor.day === day;
            return (
              <button
                key={day}
                type="button"
                // A day outside the bounds is genuinely not for you — unlike
                // the field itself, it holds no value, so `disabled` is the
                // right refusal here and drops it from the tab order too.
                disabled={blocked}
                data-cursor={isCursor || undefined}
                aria-selected={isSelected}
                // Roving tabindex: one tab stop for the whole grid. Tabbing
                // through 31 buttons to leave a calendar is how a keyboard user
                // ends up trapped in one.
                tabIndex={isCursor ? 0 : -1}
                onFocus={() => setCursor({ year: view.year, month: view.month, day })}
                onClick={() => commit({ year: view.year, month: view.month, day })}
                className={cn(
                  // Mono, like every other date in the system, so the columns
                  // of a month align on their digits instead of drifting with
                  // the width of a 1 against an 8.
                  'flex h-28 w-28 items-center justify-center rounded-control-xs font-mono text-12 tabular-nums',
                  // The focused day wears the inward ring — a day cell is inside
                  // a grid, where an outward halo would overlap its neighbours.
                  focusRing(field.scale, 'focus-visible', 'inward'),
                  // The cursor is drawn from STATE, not from `:focus`: it has to
                  // survive the grid losing focus to the typed-date box below,
                  // and it is the same rim either way so the two cannot disagree.
                  isCursor && !isSelected && cursorRing(field.scale),
                  isSelected
                    ? // A solid rung-9 tile, on the field's own ramp rather than
                      // a hardcoded indigo — a danger-toned picker used to open
                      // onto an indigo selection.
                      `bg-${field.scale}-9 text-${field.scale}-contrast`
                    : isToday
                      ? // Today is a 1px INSET outline: the tile is 28px and an
                        // outward ring on the middle of a grid overlaps the days
                        // either side of it. It also used to name two ring
                        // colours at once, so which one won was down to order.
                        `text-gray-12 ring-1 ring-inset ring-${field.scale}-9 hover:bg-gray-4`
                      : 'text-gray-12 hover:bg-gray-4',
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
            size: 'xs',
            state: field.state,
            scale: field.scale,
            className: 'mt-10 w-full px-9 font-mono text-12/17 text-gray-9',
          })}
        />
      </PopoverContent>
    </Popover>
  );
}
