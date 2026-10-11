import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

export function Controlled() {
  const [value, setValue] = useState('comfortable');
  return <RadioGroup label="Density" options={DENSITY} value={value} onChange={setValue} />;
}
