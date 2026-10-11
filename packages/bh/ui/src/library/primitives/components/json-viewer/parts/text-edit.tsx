import { useState, type KeyboardEvent } from 'react';
import { cn } from '../../../../../style/cn';
import { Icon } from '../../icon';
import { parseJson } from '../utils/parse-json';
import { ToolButton } from './tool-button';

/**
 * The editor that opens over a whole branch, seeded with that branch pretty-printed.
 *
 * This is what keeps a structured editor sufficient. Retyping a forty-node graph one value at a
 * time is not editing, it is transcription - so any container can be opened as text, which is also
 * the only way to paste a document in from somewhere else. The same parser checks it, so the error
 * reads the same here as it does anywhere else in the viewer.
 *
 * Save commits, Escape closes, and Cmd/Ctrl+Enter saves from the keyboard, since a textarea takes
 * Enter for itself.
 */
export function TextEdit({
  value,
  label,
  onCommit,
  onCancel,
}: {
  value: string;
  label: string;
  onCommit: (draft: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const parsed = parseJson(draft);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (parsed.ok) {
        onCommit(draft);
      }
    }
  };

  return (
    <span className="my-2 flex min-w-0 flex-col gap-4">
      <textarea
        autoFocus={true}
        aria-label={label}
        aria-invalid={!parsed.ok}
        spellCheck={false}
        value={draft}
        rows={Math.min(Math.max(draft.split('\n').length, 3), 24)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          'text-11/16 bg-surface-raised text-gray-12 rounded-4 w-full border-1 p-6 font-mono outline-none',
          parsed.ok ? 'border-indigo-7' : 'border-red-7',
        )}
      />
      {!parsed.ok && (
        <span role="alert" className="text-10 text-red-11 flex items-center gap-4">
          <Icon name="triangle-alert" size="2xs" />
          {parsed.line === null
            ? parsed.message
            : `Line ${parsed.line}, column ${parsed.column}: ${parsed.message}`}
        </span>
      )}
      <span className="flex items-center gap-4">
        <ToolButton
          icon="check"
          label="Save"
          disabled={!parsed.ok}
          onClick={() => parsed.ok && onCommit(draft)}
        />
        <ToolButton icon="x" label="Cancel" onClick={onCancel} />
      </span>
    </span>
  );
}
