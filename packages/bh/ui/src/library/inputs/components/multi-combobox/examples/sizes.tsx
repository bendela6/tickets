import { useState } from 'react';
import { MultiCombobox, type ControlSize, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const [fruits, setFruits] = useState<string[]>(['apple', 'lime']);
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <MultiCombobox
            key={size}
            size={size}
            placeholder="Fruits"
            options={FRUITS}
            value={fruits}
            onChange={setFruits}
          />
        );
      })}
    </div>
  );
}
