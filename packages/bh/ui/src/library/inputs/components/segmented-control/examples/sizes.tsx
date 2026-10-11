import { useState } from 'react';
import { SegmentedControl, type ControlSize } from '@bh/ui';

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState('week');
  return (
    <SegmentedControl
      label={`Range, ${size}`}
      size={size}
      options={RANGES}
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
