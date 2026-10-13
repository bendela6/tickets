import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'rome', label: 'Rome' },
];

export function Danger() {
  const id = useId();
  const [city, setCity] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id} required>
        City
      </FieldLabel>
      <Combobox
        id={id}
        tone={city === null ? 'danger' : undefined}
        options={CITIES}
        value={city}
        onChange={setCity}
        placeholder="Choose a city"
      />
    </div>
  );
}
