import { useState } from 'react';
import { SegmentedControl } from '@bh/ui';

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'modified', label: 'Last modified' },
];

export function FillingARow() {
  const [value, setValue] = useState('name');
  return (
    <SegmentedControl
      label="Sort by"
      className="flex w-full"
      options={SORTS}
      value={value}
      onChange={setValue}
    />
  );
}
