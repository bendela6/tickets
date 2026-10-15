import { useState } from 'react';
import { SegmentedControl, type Option } from '@bh/ui';

const SHOW: Option[] = [
  { value: 'all', label: 'All', count: 412 },
  { value: 'unwatched', label: 'Unwatched', count: 138 },
  { value: 'long-ago', label: 'Watched long ago', count: 61 },
];

export function WithCounts() {
  const [value, setValue] = useState('all');
  return (
    <SegmentedControl label="Show" options={SHOW} value={value} onChange={setValue} size="lg" />
  );
}
