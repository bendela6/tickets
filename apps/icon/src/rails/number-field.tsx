import { useEffect, useState } from 'react';

/**
 * What a field reads when the objects under it do not agree.
 *
 * A word rather than a blank. A blank field reads as "no value", invites a
 * blur that would write one, and says nothing about why it is empty; `mixed`
 * is a statement about the selection. It is still a live field — typing a
 * number over it commits that number to every selected object — so this is the
 * current answer rather than a disabled state.
 */
export const MIXED = 'mixed';

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
  mixed = false,
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
  /**
   * The objects under this field disagree, so `value` is one of their answers
   * rather than everyone's and must not be printed as though it were.
   */
  mixed?: boolean;
}) {
  const shown = mixed ? MIXED : String(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = (text: string) => {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setDraft(shown);
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    // Out of a mixed field, even the value one object already has is a change:
    // it is what the others are being told to become.
    if (mixed || clamped !== value) onCommit(clamped);
    setDraft(String(clamped));
  };

  // Nothing to step from while the field is mixed: `value` is one object's
  // answer, and nudging it would quietly make it everyone's.
  const nudge = (direction: 1 | -1) => {
    if (!mixed) commit(String(value + direction * step));
  };

  return (
    <label className="flex h-30 items-center gap-6 rounded-md border-1 border-gray-6 bg-surface-raised px-9">
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
          if (event.key === 'Escape') setDraft(shown);
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
