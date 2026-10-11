import { useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'madrid', label: 'Madrid' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'paris', label: 'Paris' },
  { value: 'rome', label: 'Rome' },
  { value: 'vienna', label: 'Vienna' },
];

export function Overflow() {
  const [cities, setCities] = useState<string[]>(['lisbon', 'oslo', 'paris', 'rome', 'vienna']);
  return (
    <div className="w-320">
      <MultiCombobox
        placeholder="Cities"
        maxChips={2}
        options={CITIES}
        value={cities}
        onChange={setCities}
      />
    </div>
  );
}
