import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../style';
import { Icon, type IconSize } from '../../icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../control';
import { fieldClass, fieldState } from '../field';
import { OptionRow } from '../option-row';
import { Popup } from '../popup';

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

/**
 * Minutes since midnight from `HH:MM`, or null.
 *
 * Strict about the range as well as the shape: `25:99` matches the digits but
 * is not a time of day, and accepting it would store a number no clock can
 * show.
 */
export function parseTime(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** `870` → `14:30`. Zero-padded both halves, so a column of times aligns. */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type TimePickerProps = ControlProps<string | null> & {
  /** Minutes between offered times. 15 unless the schedule is finer. */
  stepMinutes?: number;
  placeholder?: string;
  label?: string;
};

/**
 * A time of day, held as `HH:MM`.
 *
 * A string rather than minutes-since-midnight because that is what an API
 * stores and what a person reads; the conversion belongs here, once, not at
 * every call site.
 *
 * Typing is always available beside the list. A 15-minute list is 96 rows, and
 * the one time you want is reliably the one that is not on it.
 */
export function TimePicker({
  id,
  value,
  onChange,
  stepMinutes = 15,
  placeholder = 'Set time…',
  label = 'Times',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selected = value ? parseTime(value) : null;
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const times = useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < 24 * 60; m += stepMinutes) out.push(m);
    return out;
  }, [stepMinutes]);

  // The design: "Scrolls to the selected time on open." A 96-row list opened at
  // midnight when the value is 14:30 asks you to find your own answer.
  useEffect(() => {
    if (!open) return;
    setDraft(value ?? '');
    const target = listRef.current?.querySelector('[data-selected="true"]');
    target?.scrollIntoView({ block: 'center' });
  }, [open, value]);

  const parsedDraft = draft.trim() === '' ? null : parseTime(draft);
  const unparsed = draft.trim() !== '' && parsedDraft === null;

  function commit(minutes: number) {
    onChange(formatTime(minutes));
    setOpen(false);
  }

  const trigger = (
    <button
      id={id}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      aria-disabled={readOnly || undefined}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        size,
        state: field.state,
        scale: field.scale,
        className: cn(
          'flex w-full items-center justify-between gap-8',
          'disabled:pointer-events-none disabled:opacity-50',
          selected !== null ? 'text-gray-12' : 'text-gray-9',
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      {/* Mono, like every date and time in the system, so a column aligns. The
          placeholder stays proportional: it is prose, not a time. */}
      {selected !== null ? (
        <span className="font-mono tabular-nums">{formatTime(selected)}</span>
      ) : (
        <span className="font-sans">{placeholder}</span>
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
      matchTriggerWidth
    >
      <div className="flex flex-col gap-6">
        <input
          type="text"
          aria-label="Enter a time"
          autoFocus
          value={draft}
          placeholder="HH:MM"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (parsedDraft !== null) commit(parsedDraft);
          }}
          className={fieldClass({
            size: 'xs',
            state: unparsed ? 'toned' : field.state,
            scale: unparsed ? 'red' : field.scale,
            className: 'w-full font-mono tabular-nums',
          })}
        />
        {unparsed ? (
          <p role="alert" className="px-2 font-sans text-11 text-red-11">
            Not a time of day.
          </p>
        ) : null}

        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="flex max-h-224 flex-col gap-2 overflow-y-auto"
        >
          {times.map((minutes) => (
            <OptionRow
              key={minutes}
              selected={minutes === selected}
              onPick={() => commit(minutes)}
              className="font-mono tabular-nums"
            >
              <span data-selected={minutes === selected || undefined}>{formatTime(minutes)}</span>
            </OptionRow>
          ))}
        </div>
      </div>
    </Popup>
  );
}
