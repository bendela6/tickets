import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'rome', label: 'Rome' },
];

export function DisabledAndReadOnly() {
  const id = useId();
  const [city, setCity] = useState<string | null>('lisbon');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <Combobox id={`${id}-disabled`} disabled options={CITIES} value={city} onChange={setCity} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <Combobox
          id={`${id}-read-only`}
          readOnly
          options={CITIES}
          value={city}
          onChange={setCity}
        />
      </div>
    </div>
  );
}
