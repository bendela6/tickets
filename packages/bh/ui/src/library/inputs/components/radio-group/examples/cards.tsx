import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function Cards() {
  const [value, setValue] = useState('system');
  return (
    <RadioGroup variant="card" label="Theme" options={THEMES} value={value} onChange={setValue} />
  );
}
