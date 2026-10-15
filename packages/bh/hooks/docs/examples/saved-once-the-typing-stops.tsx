import { useState } from 'react';
import { useDebouncedCallback } from '@bh/hooks';

// A note saved once the typing stops for a second, or at once from its
// button: a plain textarea and buttons, no component of bh's.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6 disabled:opacity-50';

export function SavedOnceTheTypingStops() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const save = useDebouncedCallback(
    (note: string) => {
      setSaved((before) => [...before, note].slice(-3));
    },
    { delay: 1000, onUnmount: 'flush' },
  );
  return (
    <div className="flex w-320 flex-col gap-8">
      <textarea
        aria-label="Note"
        value={text}
        rows={3}
        onChange={(event) => {
          setText(event.target.value);
          save.run(event.target.value);
        }}
        className="border-gray-6 rounded-6 border-1 px-8 py-4"
      />
      <div className="flex items-center gap-8">
        <button type="button" className={BUTTON} disabled={!save.isPending} onClick={save.flush}>
          Save now
        </button>
        <button type="button" className={BUTTON} disabled={!save.isPending} onClick={save.cancel}>
          Don’t save
        </button>
        <span className="text-12/17 text-gray-10">{save.isPending ? 'Unsaved' : 'Saved'}</span>
      </div>
      <ol className="text-12/17 text-gray-11 font-mono">
        {saved.map((note, index) => {
          return <li key={index}>{note === '' ? '(empty)' : note}</li>;
        })}
      </ol>
    </div>
  );
}
