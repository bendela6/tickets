import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor', detail: '@mira' },
  { id: 'tomas', name: 'Tomas Reyes', detail: '@tomas' },
  { id: 'lena', name: 'Lena Varga', detail: '@lena' },
  { id: 'owen', name: 'Owen Pryce', detail: '@owen' },
  { id: 'iris', name: 'Iris Holm', detail: '@iris' },
];

export function SeveralPeople() {
  const id = useId();
  const [readers, setReaders] = useState<string[]>(['mira', 'tomas', 'lena', 'owen']);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Readers</FieldLabel>
      <UserPicker id={id} multiple people={PEOPLE} value={readers} onChange={setReaders} />
    </div>
  );
}
