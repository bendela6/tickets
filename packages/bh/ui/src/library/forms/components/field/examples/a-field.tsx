import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function AField() {
  const [name, setName] = useState('');
  return (
    <Field
      id="project-name"
      label="Name"
      hint="Its files are named after it."
      required
      className="w-320"
    >
      <Input
        id="project-name"
        aria-describedby="project-name-hint"
        value={name}
        onChange={setName}
        placeholder="north-wing"
      />
    </Field>
  );
}
