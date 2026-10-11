import { useId, useState } from 'react';
import { FieldLabel, Input } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [name, setName] = useState('');
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Name</FieldLabel>
      <Input id={id} value={name} onChange={setName} placeholder="Your name" />
    </div>
  );
}
