import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function WithAnError() {
  const [name, setName] = useState('North Wing');
  const error = /^[a-z0-9-]*$/.test(name) ? undefined : 'Use lowercase letters, digits and dashes';
  return (
    <Field
      id="folder-name"
      label="Folder"
      hint="Lowercase, with dashes between words."
      error={error}
      className="w-320"
    >
      <Input id="folder-name" value={name} onChange={setName} tone={error ? 'danger' : undefined} />
    </Field>
  );
}
