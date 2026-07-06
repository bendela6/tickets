import { useState } from 'react';
import { cn } from './cn';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { formatExact } from './relative-date';

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
  size?: 'compact' | 'regular';
  disabled?: boolean;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  placeholder = 'Set date…',
  size = 'regular',
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
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
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-[8px] border border-control bg-raised px-3 font-sans text-[14px]',
            'hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-subtle',
            'disabled:pointer-events-none disabled:opacity-50',
            size === 'compact' ? 'h-7' : 'h-9',
            selected ? 'text-ink' : 'text-ink-3',
            className,
          )}
        >
          {value ? formatExact(value) : placeholder}
          <span aria-hidden className="text-[10px] text-ink-3">
            ▾
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-59 rounded-[10px] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-2 hover:bg-inset"
          >
            ‹
          </button>
          <span className="font-sans text-ui font-semibold text-ink">
            {MONTH_NAMES[view.month]} {view.year}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-2 hover:bg-inset"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-[repeat(7,28px)] justify-center gap-0.5">
          {WEEKDAYS.map((weekday, index) => (
            <div key={index} className="text-center font-mono text-[10px] font-medium text-ink-3">
              {weekday}
            </div>
          ))}
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`blank-${index}`} />;
            }
            const isSelected =
              selected?.year === view.year && selected?.month === view.month && selected?.day === day;
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
                  'flex h-7 w-7 items-center justify-center rounded-md font-sans text-[12px]',
                  isSelected
                    ? 'bg-accent text-on-accent'
                    : isToday
                      ? 'text-ink ring-1 ring-inset ring-accent hover:bg-inset'
                      : 'text-ink hover:bg-inset',
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
          className="mt-2.5 h-7 w-full rounded-md border border-control bg-raised px-2.25 font-mono text-meta text-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-subtle"
        />
      </PopoverContent>
    </Popover>
  );
}
