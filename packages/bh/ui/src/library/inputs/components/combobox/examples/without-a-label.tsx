import { useState } from 'react';
import { Combobox, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function WithoutALabel() {
  const [fruit, setFruit] = useState<string | null>('lime');
  return (
    <Combobox
      aria-label="Fruit"
      searchable={false}
      options={FRUITS}
      value={fruit}
      onChange={setFruit}
      className="w-256"
    />
  );
}
