import { useState } from 'react';
import { FieldError, FieldLabel, Input } from '@bh/ui';

export function UnderTheField() {
  const [key, setKey] = useState('Main Key');
  return (
    <div className="flex w-240 flex-col gap-4">
      <FieldLabel htmlFor="key" required>
        Key
      </FieldLabel>
      <Input id="key" value={key} onChange={setKey} tone="danger" aria-describedby="key-error" />
      <FieldError id="key-error">Use lowercase letters and dashes only</FieldError>
    </div>
  );
}
