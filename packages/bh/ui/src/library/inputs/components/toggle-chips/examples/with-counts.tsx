import { useState } from 'react';
import { ToggleChips, type Option } from '@bh/ui';

const STATUSES: Option[] = [
  { value: 'running', label: 'Running', color: 'blue', count: 9 },
  { value: 'failed', label: 'Failed', color: 'red', count: 3 },
  { value: 'waiting', label: 'Waiting', color: 'orange', count: 14 },
  { value: 'finished', label: 'Finished', color: 'green', count: 21 },
];

export function WithCounts() {
  const [value, setValue] = useState<string[]>(['running', 'failed']);
  return (
    <ToggleChips label="Status" options={STATUSES} value={value} onChange={setValue} size="xs" />
  );
}
