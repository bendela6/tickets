import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor', detail: '@mira' },
  {
    id: 'tomas',
    name: 'Tomas Reyes',
    detail: '@tomas',
    disabled: true,
    disabledReason: 'Away until Monday.',
  },
  { id: 'lena', name: 'Lena Varga', detail: '@lena' },
  { id: 'owen', name: 'Owen Pryce', detail: '@owen' },
];

export function DisabledWithAReason() {
  const id = useId();
  const [owner, setOwner] = useState<string[]>(['mira']);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Owner</FieldLabel>
      <UserPicker id={id} people={PEOPLE} value={owner} onChange={setOwner} />
    </div>
  );
}
