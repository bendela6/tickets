import { useState } from 'react';
import { SegmentedControl } from '@bh/ui';

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function Controlled() {
  const [value, setValue] = useState('week');
  return <SegmentedControl label="Range" options={RANGES} value={value} onChange={setValue} />;
}
