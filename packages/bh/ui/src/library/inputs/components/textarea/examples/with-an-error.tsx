import { useId, useState } from 'react';
import { FieldError, FieldLabel, Textarea } from '@bh/ui';

export function WithAnError() {
  const id = useId();
  const [notes, setNotes] = useState('');
  const invalid = notes.trim() === '';
  return (
    <div className="flex w-288 flex-col gap-4">
      <FieldLabel htmlFor={id} required>
        Notes
      </FieldLabel>
      <Textarea
        id={id}
        value={notes}
        onChange={setNotes}
        tone={invalid ? 'danger' : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
      />
      {invalid ? <FieldError id={`${id}-error`}>Add a note.</FieldError> : null}
    </div>
  );
}
