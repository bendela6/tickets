import { useEffect, useState } from 'react';

/**
 * A hairline field holding one number, which is what almost every row in the
 * properties rail is: a small uppercase label on the left, the value right-
 * aligned in mono.
 *
 * Editing is deferred — the document takes the value on blur or Enter, not on
 * every keystroke — so typing `-` or clearing the field to retype it does not
 * momentarily move the shape to zero and fill the undo history on the way.
 */
export function NumberField({
  label,
  name,
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  /** The short mark printed in the field — `X`, `W`, `ROTATION`. */
  label: string;
  /**
   * The accessible name, when the printed mark is too terse to be unique. A
   * box's width and a stroke's width both read `W` in the rail, and two
   * fields called "W" in one panel are unusable by voice or screen reader.
   */
  name?: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (text: string) => {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    if (clamped !== value) onCommit(clamped);
    setDraft(String(clamped));
  };

  const nudge = (direction: 1 | -1) => commit(String(value + direction * step));

  return (
    <label className="flex h-7.5 items-center gap-1.5 rounded-md border-1 border-gray-6 bg-surface-raised px-2.25">
      <span className="flex-none font-mono text-9 text-gray-9">{label}</span>
      <input
        aria-label={name ?? label}
        inputMode="numeric"
        disabled={disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value);
          if (event.key === 'Escape') setDraft(String(value));
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            nudge(1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            nudge(-1);
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-right font-mono text-12 text-gray-12 outline-none disabled:text-gray-9"
      />
      {suffix ? <span className="flex-none font-mono text-11 text-gray-9">{suffix}</span> : null}
    </label>
  );
}
