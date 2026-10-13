import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function NotesSavedOnLeaving() {
  const [notes, setNotes] = useState('Bring the floor plans.');
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-320 flex-col gap-6">
      <Textarea
        aria-label="Notes"
        value={notes}
        commit="leave"
        onChange={(next) => {
          setNotes(next);
          setSaves((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        Saved {saves} {saves === 1 ? 'time' : 'times'}. Enter is a new line; Ctrl+Enter saves.
      </p>
    </div>
  );
}
