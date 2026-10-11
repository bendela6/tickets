import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../../../../../style/cn';
import { parseJson } from '../utils/parse-json';

/** What is being typed, which decides how the draft is read back. */
export type InlineEditKind = 'key' | 'value';

/**
 * The one-line editor that opens over a key or a value.
 *
 * A value is typed as JSON, seeded with the JSON already on the line. That is one input instead of
 * a type picker beside a text box: `42` is a number, `"42"` is a string, `null` is null, and `{}`
 * turns the leaf into an object the reader can then fill in. A key is not JSON - a key is always a
 * string - so it is typed bare, without the quotes it is drawn with.
 *
 * Enter commits, Escape restores. Blur commits a draft that parses and restores one that does not:
 * the error is on screen the whole time it is being typed, so a blur with the error showing is a
 * decision, not a surprise.
 */
export function InlineEdit({
  value,
  kind,
  label,
  onCommit,
  onCancel,
}: {
  value: string;
  kind: InlineEditKind;
  label: string;
  onCommit: (draft: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  // A key has no syntax to get wrong; only an empty one is refused, and it is refused by the
  // rename itself rather than reported here.
  const failure = kind === 'value' ? parseJson(draft) : { ok: true as const };
  const invalid = !failure.ok;

  /**
   * One answer per editor, whichever way it is given.
   *
   * Committing moves focus back to the document so the keyboard undo has somewhere to land, and
   * that focus moves while this input is still mounted - so the blur handler fires straight after
   * the Enter that closed it. Without this latch that is two edits on the undo stack for one
   * change, and undoing once would appear to do nothing.
   */
  const settled = useRef(false);
  const settle = (answer: () => void) => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    answer();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!invalid) {
        settle(() => onCommit(draft));
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      settle(onCancel);
    }
  };

  return (
    <span className="inline-flex items-baseline gap-6 align-baseline">
      <input
        // The one place autofocus is right: the input exists because the reader just clicked the
        // run it is covering, and it is gone again the moment they leave.
        autoFocus={true}
        aria-label={label}
        aria-invalid={invalid}
        spellCheck={false}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => settle(invalid ? onCancel : () => onCommit(draft))}
        onFocus={(event) => event.target.select()}
        // Sized to its own content in `ch`, which is exact in a monospace face, so the line does
        // not jump when the editor opens over a run it is the same length as.
        style={{ width: `${Math.min(Math.max(draft.length + 1, 3), 80)}ch` }}
        className={cn(
          'text-11/16 bg-surface-raised rounded-3 border-1 px-2 py-0 font-mono outline-none',
          invalid ? 'border-red-7 text-red-11' : 'border-indigo-7 text-gray-12',
        )}
      />
      {!failure.ok && <span className="text-10 text-red-11 font-sans">{failure.message}</span>}
    </span>
  );
}
