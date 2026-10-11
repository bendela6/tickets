import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type ControlSize, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor' },
  { id: 'tomas', name: 'Tomas Reyes' },
  { id: 'lena', name: 'Lena Varga' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [owner, setOwner] = useState<string[]>(['lena']);
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <UserPicker
              id={`${id}-${size}`}
              size={size}
              people={PEOPLE}
              value={owner}
              onChange={setOwner}
            />
          </div>
        );
      })}
    </div>
  );
}
