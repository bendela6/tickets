import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  'Amsterdam',
  'Berlin',
  'Dublin',
  'Lisbon',
  'Madrid',
  'Oslo',
  'Paris',
  'Prague',
  'Rome',
  'Vienna',
  'Warsaw',
  'Zurich',
].map((city) => ({ value: city.toLowerCase(), label: city }));

export function Searching() {
  const id = useId();
  const [city, setCity] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>City</FieldLabel>
      <Combobox
        id={id}
        options={CITIES}
        value={city}
        onChange={setCity}
        placeholder="Choose a city"
      />
    </div>
  );
}
