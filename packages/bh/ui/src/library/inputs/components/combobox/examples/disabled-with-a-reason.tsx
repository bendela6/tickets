import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  {
    value: 'oslo',
    label: 'Oslo',
    disabled: true,
    disabledReason: "We don't ship outside the EU yet.",
  },
  { value: 'rome', label: 'Rome' },
  { value: 'vienna', label: 'Vienna' },
  {
    value: 'zurich',
    label: 'Zurich',
    disabled: true,
    disabledReason: "We don't ship outside the EU yet.",
  },
];

export function DisabledWithAReason() {
  const id = useId();
  const [city, setCity] = useState<string | null>('rome');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Ship to</FieldLabel>
      <Combobox id={id} options={CITIES} value={city} onChange={setCity} />
    </div>
  );
}
