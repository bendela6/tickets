import { useId, useState } from 'react';
import { FieldLabel, Select, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'grape', label: 'Grape', disabled: true },
];

export function WithALabel() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Fruit</FieldLabel>
      <Select
        id={id}
        options={FRUITS}
        value={fruit}
        onChange={setFruit}
        placeholder="Choose a fruit"
      />
    </div>
  );
}
