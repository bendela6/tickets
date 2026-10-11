import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function Sizes() {
  const [notes, setNotes] = useState('Pack a coat and an umbrella.');
  return (
    <div className="flex w-288 flex-col gap-8">
      <Textarea size="xs" aria-label="Notes, extra small" value={notes} onChange={setNotes} />
      <Textarea size="md" aria-label="Notes, medium" value={notes} onChange={setNotes} />
      <Textarea size="lg" aria-label="Notes, large" value={notes} onChange={setNotes} />
    </div>
  );
}
