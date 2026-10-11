import { useState } from 'react';
import { RadioGroup, type ControlSize } from '@bh/ui';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState('comfortable');
  return (
    <RadioGroup
      label={`Density, ${size}`}
      size={size}
      options={DENSITY}
      value={value}
      onChange={setValue}
    />
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col items-start gap-12">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
