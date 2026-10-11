import { useState } from 'react';
import { ToggleChips } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'grape', label: 'Grape' },
];

export function Controlled() {
  const [value, setValue] = useState<string[]>(['banana']);
  return <ToggleChips label="Fruits" options={FRUITS} value={value} onChange={setValue} />;
}
