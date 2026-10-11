import { useId, useState } from 'react';
import { FieldLabel, Select, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

export function DisabledAndReadOnly() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('apple');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <Select id={`${id}-disabled`} disabled options={FRUITS} value={fruit} onChange={setFruit} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <Select
          id={`${id}-read-only`}
          readOnly
          options={FRUITS}
          value={fruit}
          onChange={setFruit}
        />
      </div>
    </div>
  );
}
