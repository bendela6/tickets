import { useState } from 'react';
import { ToggleChips, type Option } from '@bh/ui';

const COLOURS: Option[] = [
  { value: 'red', label: 'Red', color: 'red' },
  { value: 'orange', label: 'Orange', color: 'orange' },
  { value: 'green', label: 'Green', color: 'green' },
  { value: 'blue', label: 'Blue', color: 'blue' },
];

export function ColouredOptions() {
  const [value, setValue] = useState<string[]>(['orange', 'blue']);
  return <ToggleChips label="Colours" options={COLOURS} value={value} onChange={setValue} />;
}
