import { useState } from 'react';
import { cn, cursorRing, focusRing } from '../../../style';
import { Icon, type IconSize } from '../../icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../control';
import { fieldClass, fieldState } from '../field';
import { Popup } from '../popup';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO day only. A zero-padded day sorts lexicographically, so `<` and `>` on
 *  these strings ARE date order — no `Date` is built and no zone can move it. */
const isoDay = (value: string) => value.slice(0, 10);

export type DateRange = [start: string | null, end: string | null];

export type DateRangePickerProps = Omit<ControlProps<DateRange>, 'value' | 'onChange'> & {
  value: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
};

/** `2026-08-04` → `4 Aug`. Short, because two of them share a trigger. */
function short(iso: string): string {
  const [year, month, day] = isoDay(iso).split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]!.slice(0, 3)}`;
}

/**
 * A span of days, held as two ISO strings.
 *
 * The half-picked state is the one that matters, and the design is specific:
 * "The pending half is a placeholder, not blank." A trigger reading `4 Aug →`
 * with nothing after it looks broken; `4 Aug → end` says the control is waiting
 * for you, which is true.
 */
export function DateRangePicker({
  id,
  value,
  onChange,
  placeholder = 'Set a range…',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const [start, end] = value;
  const today = new Date();
  const [view, setView] = useState(() => {
    const anchor = start ? isoDay(start).split('-').map(Number) : null;
    return anchor
      ? { year: anchor[0]!, month: anchor[1]! - 1 }
      : { year: today.getUTCFullYear(), month: today.getUTCMonth() };
  });
  /** The day under the pointer while the second half is pending. Painting the
   *  span as you move is what makes a range feel picked rather than typed. */
  const [preview, setPreview] = useState<string | null>(null);

  const picking = start !== null && end === null;
  const previewEnd = picking && preview ? preview : end ? isoDay(end) : null;

  const startDay = start ? isoDay(start) : null;
  // Normalised so a preview that runs BACKWARDS from the start still paints:
  // dragging left from the anchor is a legitimate way to pick a range.
  const [spanFrom, spanTo] =
    startDay && previewEnd
      ? startDay <= previewEnd
        ? [startDay, previewEnd]
        : [previewEnd, startDay]
      : [null, null];

  const startWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_unused, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setView((current) => {
      const next = current.month + delta;
      return { year: current.year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });
  }

  function pick(iso: string) {
    if (readOnly) return;
    // A third click starts over. Without it, a range once set can only be
    // narrowed from whichever end you happen to click.
    if (!picking) {
      onChange([`${iso}T00:00:00Z`, null]);
      setPreview(null);
      return;
    }
    const anchor = isoDay(start!);
    const [from, to] = iso < anchor ? [iso, anchor] : [anchor, iso];
    onChange([`${from}T00:00:00Z`, `${to}T00:00:00Z`]);
    setPreview(null);
    setOpen(false);
  }

  const trigger = (
    <button
      id={id}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="dialog"
      disabled={disabled}
      aria-disabled={readOnly || undefined}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        size,
        state: field.state,
        scale: field.scale,
        focus: 'focus-visible',
        className: cn(
          'flex w-full items-center justify-between gap-8 font-sans',
          start ? 'text-gray-12' : 'text-gray-9',
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      {start ? (
        <span className="flex min-w-0 items-center gap-6">
          <span className="font-mono tabular-nums">{short(start)}</span>
          {/* An arrow at rung 9, not a hyphen: a hyphen between two dates reads
              as a subtraction or a typo, and a range has a direction. */}
          <span aria-hidden className="text-gray-9">→</span>
          {end ? (
            <span className="font-mono tabular-nums">{short(end)}</span>
          ) : (
            // The pending half is a PLACEHOLDER, not blank. "4 Aug →" with
            // nothing after it looks broken; "4 Aug → end" is waiting for you.
            <span className="font-sans text-gray-9">end</span>
          )}
        </span>
      ) : (
        placeholder
      )}
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="shrink-0 text-gray-9" />
      )}
    </button>
  );

  return (
    <Popup
      open={open}
      onOpenChange={(next) => setOpen(readOnly ? false : next)}
      trigger={trigger}
      className="w-236"
    >
      <div className="p-7" onMouseLeave={() => setPreview(null)}>
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="inline-flex size-24 items-center justify-center rounded-control-xs text-gray-11 hover:bg-gray-4"
          >
            <Icon name="chevron-left" size="xs" />
          </button>
          <span className="font-sans text-13 font-600 text-gray-12">
            {MONTHS[view.month]} {view.year}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="inline-flex size-24 items-center justify-center rounded-control-xs text-gray-11 hover:bg-gray-4"
          >
            <Icon name="chevron-right" size="xs" />
          </button>
        </div>

        {/* `gap-0` on the row axis so the span reads as one continuous bar —
            a gap between tiles would break it into stripes. */}
        <div role="grid" className="grid grid-cols-[repeat(7,28px)] justify-center gap-y-2">
          {WEEKDAYS.map((weekday, index) => (
            <div key={index} className="text-center font-mono text-10 font-500 text-gray-9">
              {weekday}
            </div>
          ))}
          {cells.map((day, index) => {
            if (day === null) return <div key={`blank-${index}`} />;
            const iso = `${view.year}-${pad(view.month + 1)}-${pad(day)}`;
            const isFrom = iso === spanFrom;
            const isTo = iso === spanTo;
            const inSpan = spanFrom !== null && spanTo !== null && iso > spanFrom && iso < spanTo;
            const isEnd = isFrom || isTo;
            return (
              <button
                key={day}
                type="button"
                aria-selected={isEnd}
                onMouseEnter={() => picking && setPreview(iso)}
                onFocus={() => picking && setPreview(iso)}
                onClick={() => pick(iso)}
                className={cn(
                  'flex h-28 w-28 items-center justify-center font-mono text-12 tabular-nums',
                  focusRing(field.scale, 'focus-visible', 'inward'),
                  // The ends are SQUARE where they meet the span and rounded on
                  // the outside, so the two tiles and the bar between them read
                  // as one shape rather than three.
                  isFrom && spanTo !== spanFrom ? 'rounded-l-control-xs' : '',
                  isTo && spanTo !== spanFrom ? 'rounded-r-control-xs' : '',
                  isEnd && spanFrom === spanTo ? 'rounded-control-xs' : '',
                  !isEnd && !inSpan ? 'rounded-control-xs' : '',
                  isEnd
                    ? `bg-${field.scale}-9 text-${field.scale}-contrast`
                    : inSpan
                      ? // Rung 2 between the ends — present enough to trace,
                        // quiet enough that the ends stay the subject.
                        `bg-${field.scale}-2 text-gray-12`
                      : 'text-gray-12 hover:bg-gray-4',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-8 border-t-1 border-gray-6 pt-8">
          <button
            type="button"
            onClick={() => {
              onChange([null, null]);
              setPreview(null);
            }}
            className="rounded-control-xs px-6 py-2 font-mono text-11 text-gray-11 hover:bg-gray-4 hover:text-gray-12"
          >
            clear
          </button>
          <span aria-hidden className="ml-auto font-mono text-10 text-gray-9">
            {picking ? 'pick the end' : 'pick a start'}
          </span>
        </div>
      </div>
    </Popup>
  );
}
