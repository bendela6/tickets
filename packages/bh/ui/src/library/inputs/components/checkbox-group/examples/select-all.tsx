import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const CITIES = [
  { value: 'lima', label: 'Lima' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'paris', label: 'Paris' },
  { value: 'tokyo', label: 'Tokyo' },
];

export function SelectAll() {
  const [value, setValue] = useState<string[]>(['oslo']);
  return (
    <CheckboxGroup
      label="Cities"
      showLabel
      selectAllLabel="All cities"
      options={CITIES}
      value={value}
      onChange={setValue}
    />
  );
}
