import { useState } from 'react';
import { cn, TONE_HUE, type Tone } from '../../style';
import { fieldClass, fieldState } from '../field';
import { Icon, type IconSize } from '../icon';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { formatExact } from '../relative-date';
import type { ControlSize } from '../control';

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

function parseParts(value: string | null): { year: number; month: number; day: number } | null {
  if (!value) {
    return null;
  }
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

type DatePickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  size?: ControlSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  className?: string;
};

const BOX: Record<ControlSize, string> = {
  sm: 'px-9 text-13',
  md: 'px-12 text-14',
  lg: 'px-14 text-15',
};

const CHEVRON: Record<ControlSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };

export function DatePicker({
  value,
  onChange,
  placeholder = 'Set date…',
  size = 'md',
  tone,
  disabled,
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

  function pick(day: number) {
    onChange(`${view.year}-${pad(view.month + 1)}-${pad(day)}T00:00:00Z`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={fieldClass({
            size,
            state: field.state,
            scale: field.scale,
            className: cn(
              'flex w-full items-center justify-between gap-8 font-sans',
              'disabled:pointer-events-none disabled:opacity-50',
              BOX[size],
              selected ? 'text-gray-12' : 'text-gray-9',
              className,
            ),
          })}
        >
          {value ? formatExact(value) : placeholder}
          <Icon name="chevron-down" size={CHEVRON[size]} className="text-gray-9" />
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
            return (
              <button
                key={day}
                type="button"
                onClick={() => pick(day)}
                className={cn(
                  'flex h-28 w-28 items-center justify-center rounded-md font-sans text-12',
                  isSelected
                    ? 'bg-indigo-9 text-indigo-contrast'
                    : isToday
                      ? 'text-gray-12 ring-1 ring-surface-inset ring-indigo-9 hover:bg-surface-inset'
                      : 'text-gray-12 hover:bg-surface-inset',
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
          defaultValue={value ? value.slice(0, 10) : ''}
          placeholder="YYYY-MM-DD"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }
            const parts = parseParts((event.target as HTMLInputElement).value);
            if (parts) {
              onChange(`${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}T00:00:00Z`);
              setOpen(false);
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
