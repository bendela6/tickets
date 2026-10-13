import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option, type OptionGroup } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'barcelona', label: 'Barcelona' },
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'madrid', label: 'Madrid' },
  { value: 'milan', label: 'Milan' },
  { value: 'naples', label: 'Naples' },
  { value: 'porto', label: 'Porto' },
  { value: 'rome', label: 'Rome' },
  { value: 'seville', label: 'Seville' },
];

const COUNTRY: Record<string, string> = {
  milan: 'it',
  naples: 'it',
  rome: 'it',
  lisbon: 'pt',
  porto: 'pt',
  barcelona: 'es',
  madrid: 'es',
  seville: 'es',
};

const COUNTRIES: OptionGroup[] = [
  { key: 'it', label: 'Italy' },
  { key: 'pt', label: 'Portugal' },
  { key: 'es', label: 'Spain' },
];

export function GroupedOptions() {
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
        groupOf={(option) => COUNTRY[option.value] ?? ''}
        groups={COUNTRIES}
      />
    </div>
  );
}
