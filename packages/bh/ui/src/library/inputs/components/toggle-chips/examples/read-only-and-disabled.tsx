import { useState } from 'react';
import { ToggleChips } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'grape', label: 'Grape', disabled: true },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState<string[]>(['banana']);
  return (
    <div className="flex flex-col gap-12">
      <ToggleChips label="Fruits" options={FRUITS} value={value} onChange={setValue} />
      <ToggleChips
        label="Fruits, read-only"
        options={FRUITS}
        value={value}
        onChange={setValue}
        readOnly
      />
      <ToggleChips
        label="Fruits, disabled"
        options={FRUITS}
        value={value}
        onChange={setValue}
        disabled
      />
    </div>
  );
}
