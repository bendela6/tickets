import { useState } from 'react';
import { SegmentedControl } from '@bh/ui';

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year', disabled: true },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState('week');
  return (
    <div className="flex flex-col items-start gap-12">
      <SegmentedControl label="Editable" options={RANGES} value={value} onChange={setValue} />
      <SegmentedControl
        label="Read-only"
        options={RANGES}
        value={value}
        onChange={setValue}
        readOnly
      />
      <SegmentedControl
        label="Disabled"
        options={RANGES}
        value={value}
        onChange={setValue}
        disabled
      />
    </div>
  );
}
