import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

export function Controlled() {
  const [value, setValue] = useState<string[]>(['banana']);
  return <CheckboxGroup label="Fruits" options={FRUITS} value={value} onChange={setValue} />;
}
