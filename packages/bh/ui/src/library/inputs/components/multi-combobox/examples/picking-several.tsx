import { useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
  { value: 'blueberry', label: 'Blueberry', color: 'blue' },
];

export function PickingSeveral() {
  const [fruits, setFruits] = useState<string[]>(['apple', 'lime']);
  return (
    <div className="w-320">
      <MultiCombobox placeholder="Fruits" options={FRUITS} value={fruits} onChange={setFruits} />
    </div>
  );
}
