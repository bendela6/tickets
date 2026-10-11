import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor' },
  { id: 'tomas', name: 'Tomas Reyes' },
  { id: 'lena', name: 'Lena Varga' },
];

export function DisabledAndReadOnly() {
  const id = useId();
  const [owner, setOwner] = useState<string[]>(['tomas']);
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <UserPicker
          id={`${id}-disabled`}
          disabled
          people={PEOPLE}
          value={owner}
          onChange={setOwner}
        />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <UserPicker
          id={`${id}-read-only`}
          readOnly
          people={PEOPLE}
          value={owner}
          onChange={setOwner}
        />
      </div>
    </div>
  );
}
