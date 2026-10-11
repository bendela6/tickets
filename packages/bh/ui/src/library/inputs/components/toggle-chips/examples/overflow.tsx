import { useState } from 'react';
import { ToggleChips } from '@bh/ui';

const CITIES = ['Lima', 'Oslo', 'Paris', 'Tokyo', 'Cairo', 'Delhi', 'Quito', 'Seoul'].map(
  (city) => {
    return { value: city.toLowerCase(), label: city };
  },
);

export function Overflow() {
  const [value, setValue] = useState<string[]>(['oslo', 'seoul']);
  return (
    <ToggleChips label="Cities" maxVisible={4} options={CITIES} value={value} onChange={setValue} />
  );
}
