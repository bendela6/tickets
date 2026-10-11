import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function ColouredOptions() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('plum');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Fruit</FieldLabel>
      <Combobox id={id} options={FRUITS} value={fruit} onChange={setFruit} />
    </div>
  );
}
