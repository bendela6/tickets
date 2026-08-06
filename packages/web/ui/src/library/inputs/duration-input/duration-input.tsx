import { useEffect, useState } from 'react';
import { cn } from '../../../style';
import { type ControlProps, readOnlyFieldClass } from '../control';
import { fieldClass, fieldState } from '../field';

export type DurationInputProps = ControlProps<number | null> & {
  placeholder?: string;
  /** A budget to measure against — an estimate, a remaining allowance. When the
   *  value exceeds it, the overage is stated rather than the field turning red:
   *  going over is a fact about the work, not a mistake in the field. */
  budgetMinutes?: number;
};

/**
 * Parse a length of time into MINUTES.
 *
 * `2h30`, `2h 30m`, `2.5h` and `150m` are the same duration and all reach 150.
 * A bare number is minutes, because that is what somebody typing `45` into a
 * time-tracking field means.
 *
 * Returns null for anything it cannot read, which the caller shows as unparsed
 * rather than silently storing a zero — `0` is a real answer and must not be
 * what a typo produces.
 */
export function parseDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  // `2h30` — the compact form, where the trailing number is minutes with no
  // unit. Checked first because the general scan below would read the 30 as
  // another bare number and add it as minutes anyway; being explicit keeps the
  // two readings from ever disagreeing.
  const compact = text.match(/^(\d+(?:\.\d+)?)h\s*(\d+)$/);
  if (compact) {
    return Math.round(Number(compact[1]) * 60 + Number(compact[2]));
  }

  const units = [...text.matchAll(/(\d+(?:\.\d+)?)\s*([hm]?)/g)].filter((match) => match[1]);
  if (units.length === 0) return null;
  // Reject trailing junk: `2h zzz` is a typo, not two hours.
  const consumed = units.reduce((total, match) => total + match[0].trim().length, 0);
  if (consumed < text.replace(/\s+/g, '').length) return null;

  let minutes = 0;
  for (const [, amount, unit] of units) {
    minutes += unit === 'h' ? Number(amount) * 60 : Number(amount);
  }
  return Math.round(minutes);
}

/** `150` → `2h 30m`. Zero is `0m`, not an empty string: a stored zero is a real
 *  answer and has to look different from nothing having been entered. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/**
 * A length of time, not a clock time.
 *
 * The distinction is the whole control: 14:30 is half past two, `2h30` is two
 * and a half hours, and an estimate field that accepted the first would be
 * storing the wrong number in a way nobody notices until a report is wrong.
 *
 * While you type it echoes what the text WILL become. A parser this forgiving
 * needs to show its working, or `2.5h` looks like it was ignored.
 */
export function DurationInput({
  id,
  value,
  onChange,
  placeholder = '2h 30m',
  budgetMinutes,
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: DurationInputProps) {
  const field = fieldState(tone);
  const [draft, setDraft] = useState(() => (value === null ? '' : formatDuration(value)));
  const [editing, setEditing] = useState(false);

  // A value changed from outside — a form reset, another field — has to reach
  // the box, but not while somebody is mid-word in it, and NOT over text the
  // parser could not read. Without that second guard, blurring an unreadable
  // entry replaced it with the last good value: the typo vanished, the field
  // looked accepted, and the correction the message asked for was impossible.
  useEffect(() => {
    if (editing) return;
    if (draft.trim() !== '' && parseDuration(draft) === null) return;
    setDraft(value === null ? '' : formatDuration(value));
  }, [value, editing, draft]);

  const parsed = parseDuration(draft);
  const unparsed = draft.trim() !== '' && parsed === null;
  const over = budgetMinutes !== undefined && value !== null && value > budgetMinutes;

  function commit() {
    setEditing(false);
    if (draft.trim() === '') {
      onChange(null);
      return;
    }
    if (parsed === null) return; // Leave the text for correction rather than eating it.
    onChange(parsed);
    setDraft(formatDuration(parsed));
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        id={id}
        type="text"
        inputMode="text"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={field.invalid || unparsed || undefined}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        className={fieldClass({
          size,
          state: unparsed ? 'toned' : field.state,
          scale: unparsed ? 'red' : field.scale,
          className: cn('w-full font-mono tabular-nums', readOnly && readOnlyFieldClass, className),
        })}
      />

      {/* The live echo. A parser that quietly accepts `2.5h` and shows nothing
          looks like a parser that ignored you. */}
      {editing && parsed !== null && draft.trim() !== formatDuration(parsed) ? (
        <p className="font-mono text-11 text-gray-9">
          {draft.trim()} = {formatDuration(parsed)}
        </p>
      ) : null}

      {unparsed ? (
        <p role="alert" className="font-sans text-11 text-red-11">
          Not a length of time. Try “2h 30m”, “2.5h” or “150m”.
        </p>
      ) : null}

      {/* Over budget is a FACT, not an error: the field is not wrong, the work
          is longer than planned. So it is stated, and the field keeps its tone. */}
      {over && !unparsed ? (
        <p className="font-mono text-11 text-orange-11">
          {formatDuration(value! - budgetMinutes!)} over estimate.
        </p>
      ) : null}
    </div>
  );
}
