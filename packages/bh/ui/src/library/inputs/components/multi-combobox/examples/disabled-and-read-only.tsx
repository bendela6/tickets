import { useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function DisabledAndReadOnly() {
  const [fruits, setFruits] = useState<string[]>(['apple', 'lime']);
  return (
    <div className="flex w-288 flex-col gap-12">
      <MultiCombobox
        disabled
        placeholder="Fruits"
        options={FRUITS}
        value={fruits}
        onChange={setFruits}
      />
      <MultiCombobox
        readOnly
        placeholder="Fruits"
        options={FRUITS}
        value={fruits}
        onChange={setFruits}
      />
    </div>
  );
}
