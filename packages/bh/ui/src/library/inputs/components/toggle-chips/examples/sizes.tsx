import { useState } from 'react';
import { ToggleChips, type ControlSize } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState<string[]>(['banana']);
  return (
    <ToggleChips
      label={`Fruits, ${size}`}
      size={size}
      options={FRUITS}
      value={value}
      onChange={setValue}
    />
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-12">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
