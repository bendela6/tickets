import { useId, useState } from 'react';
import { FieldLabel, Input } from '@bh/ui';

export function AFieldSavedOnLeaving() {
  const id = useId();
  const [city, setCity] = useState('Lisbon');
  const [draft, setDraft] = useState(city);
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-256 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={id}>City</FieldLabel>
        <Input
          id={id}
          value={city}
          commit="leave"
          onDraft={setDraft}
          onChange={(next) => {
            setCity(next);
            setSaves((count) => count + 1);
          }}
        />
      </div>
      <p className="text-12/17 text-gray-11 font-sans">
        Draft <span className="text-gray-12 font-mono">{draft}</span>
      </p>
      <p className="text-12/17 text-gray-11 font-sans">
        Saved <span className="text-gray-12 font-mono">{city}</span>, {saves}{' '}
        {saves === 1 ? 'time' : 'times'}
      </p>
    </div>
  );
}
