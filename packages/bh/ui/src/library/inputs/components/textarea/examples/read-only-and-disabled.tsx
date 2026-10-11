import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [notes, setNotes] = useState('Pack a coat and an umbrella.');
  return (
    <div className="flex w-288 flex-col gap-8">
      <Textarea aria-label="Notes, read-only" value={notes} onChange={setNotes} readOnly />
      <Textarea aria-label="Notes, disabled" value={notes} onChange={setNotes} disabled />
    </div>
  );
}
