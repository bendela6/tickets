import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function Pill() {
  const [value, setValue] = useState('week');
  return <Tabs variant="pill" items={ITEMS} value={value} onChange={setValue} label="Range" />;
}
