import { useId, useState } from 'react';
import { FieldLabel, Textarea } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [notes, setNotes] = useState('');
  return (
    <div className="flex w-288 flex-col gap-4">
      <FieldLabel htmlFor={id}>Notes</FieldLabel>
      <Textarea id={id} value={notes} onChange={setNotes} placeholder="Anything to add" />
    </div>
  );
}
