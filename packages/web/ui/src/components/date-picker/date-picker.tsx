import { useState } from 'react';
import { cn, TONE_SCALE, type Tone } from '../../style';
import { fieldClass, type FieldSize } from '../field';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { formatExact } from '../relative-date';

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
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  className?: string;
};

const BOX: Record<FieldSize, string> = {
  sm: 'px-2.25 text-[13px]',
  md: 'px-3 text-[14px]',
  lg: 'px-3.5 text-[15px]',
};

export function DatePicker({
  value,
  onChange,
  placeholder = 'Set date…',
  size = 'md',
  tone = 'primary',
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
          className={fieldClass({
            size,
            scale: TONE_SCALE[tone],
            className: cn(
              'flex w-full items-center justify-between gap-2 font-sans',
              'disabled:pointer-events-none disabled:opacity-50',
              BOX[size],
              selected ? 'text-gray-12' : 'text-gray-9',
              className,
            ),
          })}
        >
          {value ? formatExact(value) : placeholder}
          <span aria-hidden className="text-[10px] text-gray-9">
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
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset"
          >
            ‹
          </button>
          <span className="font-sans text-ui font-semibold text-gray-12">
            {MONTH_NAMES[view.month]} {view.year}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-[repeat(7,28px)] justify-center gap-0.5">
          {WEEKDAYS.map((weekday, index) => (
            <div key={index} className="text-center font-mono text-[10px] font-medium text-gray-9">
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
                  'flex h-7 w-7 items-center justify-center rounded-md font-sans text-[12px]',
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
            scale: TONE_SCALE[tone],
            className: 'mt-2.5 w-full px-2.25 font-mono text-meta text-gray-9',
          })}
        />
      </PopoverContent>
    </Popover>
  );
}
