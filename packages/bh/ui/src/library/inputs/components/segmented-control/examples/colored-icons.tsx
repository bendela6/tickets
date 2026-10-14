import { useState } from 'react';
import { SegmentedControl, type Option } from '@bh/ui';

const STAGES: Option[] = [
  { value: 'waiting', label: 'Waiting', icon: 'circle', color: 'gray' },
  { value: 'moving', label: 'Moving', icon: 'circle-half', color: 'blue' },
  { value: 'arrived', label: 'Arrived', icon: 'circle-check', color: 'green' },
  { value: 'lost', label: 'Lost', icon: 'circle-x', color: 'red', disabled: true },
];

export function ColoredIcons() {
  const [value, setValue] = useState('moving');
  return <SegmentedControl label="Stage" options={STAGES} value={value} onChange={setValue} />;
}
