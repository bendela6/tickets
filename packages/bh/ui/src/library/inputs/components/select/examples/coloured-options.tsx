import { useState } from 'react';
import { Select, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function ColouredOptions() {
  const [fruit, setFruit] = useState<string | null>('lime');
  return (
    <Select
      aria-label="Fruit"
      options={FRUITS}
      value={fruit}
      onChange={setFruit}
      className="w-256"
    />
  );
}
