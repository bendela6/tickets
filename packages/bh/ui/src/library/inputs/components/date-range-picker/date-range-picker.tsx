import { useState } from 'react';
import { cn, focusRing } from '../../../../style';
import { Button } from '../../../primitives/components/button';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../../contract';
import { fieldClass, fieldState } from '../../parts/field';
import { Popup } from '../../parts/popup';

const MONTHS = [
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
const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

const pad = (n: number) => String(n).padStart(2, '0');

export type DateRange = [start: string | null, end: string | null];

/** What one pick is: a day, or a whole month. */
export type DateRangeGranularity = 'day' | 'month';

export type DateRangePickerProps = Omit<ControlProps<DateRange>, 'value' | 'onChange'> & {
  /** The two ends, start then end, each an ISO string or `null`. */
  value: DateRange;
  /** The new pair, start first even when the range was picked backwards. */
  onChange: (value: DateRange) => void;
  /** Shown in the field while no start is picked. */
  placeholder?: string;
  /**
   * What one pick is. `day` (the default) holds each end as an ISO instant,
   * `2026-08-04T00:00:00Z`; `month` holds it as `2026-08`, for a span a
   * calendar of days is too fine for: a tenancy, a contract, a term.
   */
  granularity?: DateRangeGranularity;
  /**
   * The name of an end that has not come yet ("Ongoing"). With it, `[start,
   * null]` is a settled range, not one waiting for its end: the trigger shows
   * this name after the arrow, and the popup offers it as a button.
   */
  openEnd?: string;
  /**
   * The accessible name, for a control with no visible label to point at it —
   * a filter under a column header, where the header is the only caption. A
   * control that has a `<label htmlFor>` should use that instead.
   */
  'aria-label'?: string;
};

/**
 * The part of a value one pick names: `2026-08-04` for a day, `2026-08` for a
 * month. Zero-padded, so these strings sort lexicographically: `<` and `>` on
 * them ARE date order, no `Date` is built and no zone can move it.
 */
function keyOf(value: string, granularity: DateRangeGranularity): string {
  return value.slice(0, granularity === 'month' ? 7 : 10);
}

/** `2026-08-04` → `4 Aug`, `2026-08` → `Aug 2026`. Short, because two of them
 *  share a trigger. */
function short(value: string, granularity: DateRangeGranularity): string {
  const [year, month, day] = keyOf(value, granularity).split('-').map(Number);
  const name = month ? MONTHS[month - 1] : undefined;
  if (!year || name === undefined) {
    return value;
  }
  if (granularity === 'month') {
    return `${name.slice(0, 3)} ${year}`;
  }
  return day ? `${day} ${name.slice(0, 3)}` : value;
}

/**
 * A span of days, or of months, held as two ISO strings.
 *
 * The half-picked state is the one that matters, and the design is specific:
 * "The pending half is a placeholder, not blank." A trigger reading `4 Aug →`
 * with nothing after it looks broken; `4 Aug → end` says the control is waiting
 * for you, which is true. A range that may still be running names its open end
 * instead (`openEnd`), and then only a pick made in the popup is pending.
 */
export function DateRangePicker({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  placeholder = 'Set a range…',
  granularity = 'day',
  openEnd,
  'aria-label': ariaLabel,
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const [start, end] = value;
  const months = granularity === 'month';
  const today = new Date();
  const [view, setView] = useState(() => {
    const [anchorYear, anchorMonth] = start ? keyOf(start, granularity).split('-').map(Number) : [];
    return anchorYear !== undefined && anchorMonth !== undefined
      ? { year: anchorYear, month: anchorMonth - 1 }
      : { year: today.getUTCFullYear(), month: today.getUTCMonth() };
  });
  /** The day or month under the pointer while the second half is pending.
   *  Painting the span as you move is what makes a range feel picked rather
   *  than typed. */
  const [preview, setPreview] = useState<string | null>(null);
  /** With an open end, `[start, null]` is settled: the start of a pick made
   *  in this popup is kept here instead, until its end is picked. */
  const [anchor, setAnchor] = useState<string | null>(null);

  const picking = openEnd === undefined ? start !== null && end === null : anchor !== null;
  const from = openEnd === undefined ? (start === null ? null : keyOf(start, granularity)) : anchor;
  const previewEnd = picking && preview ? preview : end ? keyOf(end, granularity) : null;

  const startKey = picking ? from : start ? keyOf(start, granularity) : null;
  // Normalised so a preview that runs BACKWARDS from the start still paints:
  // dragging left from the anchor is a legitimate way to pick a range. A
  // settled range with an open end paints its start alone.
  const [spanFrom, spanTo] =
    startKey && previewEnd
      ? startKey <= previewEnd
        ? [startKey, previewEnd]
        : [previewEnd, startKey]
      : openEnd !== undefined && !picking
        ? [startKey, startKey]
        : [null, null];

  const startWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_unused, i) => i + 1),
  ];

  /** A key as the value holds it. */
  const valueOf = (key: string) => (months ? key : `${key}T00:00:00Z`);

  function shift(delta: number) {
    setView((current) => {
      if (months) {
        return { ...current, year: current.year + delta };
      }
      const next = current.month + delta;
      return { year: current.year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });
  }

  function close() {
    setAnchor(null);
    setPreview(null);
    setOpen(false);
  }

  function pick(key: string) {
    if (readOnly) {
      return;
    }
    // A third click starts over. Without it, a range once set can only be
    // narrowed from whichever end you happen to click.
    if (!picking || from === null) {
      onChange([valueOf(key), null]);
      if (openEnd !== undefined) {
        setAnchor(key);
      }
      setPreview(null);
      return;
    }
    const [low, high] = key < from ? [key, from] : [from, key];
    onChange([valueOf(low), valueOf(high)]);
    close();
  }

  /** The tile for one day or month: square where it meets the span, rounded
   *  on the outside, so the two ends and the bar between them read as one
   *  shape rather than three. */
  function tileClass(key: string): string {
    const isFrom = key === spanFrom;
    const isTo = key === spanTo;
    const inSpan = spanFrom !== null && spanTo !== null && key > spanFrom && key < spanTo;
    const isEnd = isFrom || isTo;
    return cn(
      'text-12 flex items-center justify-center tabular-nums',
      months ? 'h-32 w-full font-sans' : 'h-28 w-28 font-mono',
      focusRing(field.scale, 'focus-visible', 'inward'),
      isFrom && spanTo !== spanFrom ? 'rounded-l-3' : '',
      isTo && spanTo !== spanFrom ? 'rounded-r-3' : '',
      isEnd && spanFrom === spanTo ? 'rounded-3' : '',
      !isEnd && !inSpan ? 'rounded-3' : '',
      isEnd
        ? `bg-${field.scale}-9 text-${field.scale}-contrast`
        : inSpan
          ? // Rung 2 between the ends — present enough to trace, quiet enough
            // that the ends stay the subject.
            `bg-${field.scale}-2 text-gray-12`
          : 'text-gray-12 hover:bg-gray-4',
    );
  }

  const trigger = (
    <button
      id={id}
      aria-describedby={ariaDescribedBy}
      type="button"
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="dialog"
      disabled={disabled}
      aria-disabled={readOnly ? true : undefined}
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
        // One line whatever the width: in a narrow table cell a date that
        // wraps reads as two ("1" over "Sep"), so a range too wide is clipped.
        <span className="flex min-w-0 items-center gap-6 overflow-hidden whitespace-nowrap">
          <span className="font-mono tabular-nums">{short(start, granularity)}</span>
          {/* An arrow at rung 9, not a hyphen: a hyphen between two dates reads
              as a subtraction or a typo, and a range has a direction. */}
          <span aria-hidden className="text-gray-9">
            →
          </span>
          {end ? (
            <span className="font-mono tabular-nums">{short(end, granularity)}</span>
          ) : openEnd !== undefined && !picking ? (
            <span className="font-sans">{openEnd}</span>
          ) : (
            // The pending half is a PLACEHOLDER, not blank. "4 Aug →" with
            // nothing after it looks broken; "4 Aug → end" is waiting for you.
            <span className="text-gray-9 font-sans">end</span>
          )}
        </span>
      ) : (
        placeholder
      )}
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="text-gray-9 shrink-0" />
      )}
    </button>
  );

  const unit = months ? 'year' : 'month';
  /** Where a range the open end would settle starts: a pick under way, or
   *  the range's own start. */
  const begun = anchor ?? (start === null ? null : keyOf(start, granularity));

  return (
    <Popup
      open={open}
      onOpenChange={(next) => {
        if (next && !readOnly) {
          setOpen(true);
        } else {
          close();
        }
      }}
      trigger={trigger}
      className="w-236"
    >
      <div className="p-7" onMouseLeave={() => setPreview(null)}>
        <div className="mb-8 flex items-center justify-between">
          <Button
            variant="ghost"
            tone="neutral"
            size="xs"
            icon="chevron-left"
            label={`Previous ${unit}`}
            onClick={() => shift(-1)}
          />
          <span className="text-13 font-600 text-gray-12 font-sans">
            {months ? view.year : `${MONTHS[view.month]} ${view.year}`}
          </span>
          <Button
            variant="ghost"
            tone="neutral"
            size="xs"
            icon="chevron-right"
            label={`Next ${unit}`}
            onClick={() => shift(1)}
          />
        </div>

        {months ? (
          // Three to a row, gap-0 across it, so a span within a row reads as
          // one continuous bar.
          <div role="grid" aria-label={String(view.year)} className="grid grid-cols-3 gap-y-4">
            {MONTHS.map((name, index) => {
              const key = `${view.year}-${pad(index + 1)}`;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${name} ${view.year}`}
                  aria-selected={key === spanFrom || key === spanTo}
                  onMouseEnter={() => picking && setPreview(key)}
                  onFocus={() => picking && setPreview(key)}
                  onClick={() => pick(key)}
                  className={tileClass(key)}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        ) : (
          // `gap-0` on the row axis so the span reads as one continuous bar —
          // a gap between tiles would break it into stripes.
          <div role="grid" className="grid grid-cols-[repeat(7,28px)] justify-center gap-y-2">
            {WEEKDAYS.map((weekday, index) => {
              return (
                <div key={index} className="text-10 font-500 text-gray-9 text-center font-mono">
                  {weekday}
                </div>
              );
            })}
            {cells.map((day, index) => {
              if (day === null) {
                return <div key={`blank-${index}`} />;
              }
              const key = `${view.year}-${pad(view.month + 1)}-${pad(day)}`;
              return (
                <button
                  key={day}
                  type="button"
                  aria-selected={key === spanFrom || key === spanTo}
                  onMouseEnter={() => picking && setPreview(key)}
                  onFocus={() => picking && setPreview(key)}
                  onClick={() => pick(key)}
                  className={tileClass(key)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        )}

        <div className="border-gray-6 mt-8 flex items-center gap-8 border-t-1 pt-8">
          <button
            type="button"
            onClick={() => {
              onChange([null, null]);
              setAnchor(null);
              setPreview(null);
            }}
            className="rounded-3 text-11 text-gray-11 hover:bg-gray-4 hover:text-gray-12 px-6 py-2 font-mono"
          >
            clear
          </button>
          {/* Offered once there is a start for it to follow. */}
          {openEnd !== undefined && begun !== null ? (
            <button
              type="button"
              onClick={() => {
                onChange([valueOf(begun), null]);
                close();
              }}
              className="rounded-3 text-11 text-gray-11 hover:bg-gray-4 hover:text-gray-12 px-6 py-2 font-sans"
            >
              {openEnd}
            </button>
          ) : null}
          <span aria-hidden className="text-10 text-gray-9 ml-auto font-mono">
            {picking ? 'pick the end' : 'pick a start'}
          </span>
        </div>
      </div>
    </Popup>
  );
}
