import { useId, useState } from 'react';
import { FieldLabel, Select, type ControlSize, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('apple');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <Select
              id={`${id}-${size}`}
              size={size}
              options={FRUITS}
              value={fruit}
              onChange={setFruit}
            />
          </div>
        );
      })}
    </div>
  );
}
