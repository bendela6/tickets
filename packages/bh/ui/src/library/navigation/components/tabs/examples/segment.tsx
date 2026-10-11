import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
];

export function Segment() {
  const [value, setValue] = useState('1');
  const [previous, setPrevious] = useState<string>();
  return (
    <Tabs
      variant="segment"
      role="group"
      items={ITEMS}
      value={value}
      previousValue={previous}
      onChange={(next) => {
        setPrevious(value);
        setValue(next);
      }}
      label="Speed"
    />
  );
}
