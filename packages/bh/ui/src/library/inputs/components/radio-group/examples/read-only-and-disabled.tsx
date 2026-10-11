import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
  { value: 'dense', label: 'Dense', disabled: true },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState('compact');
  return (
    <div className="flex flex-col items-start gap-12">
      <RadioGroup label="Editable" options={DENSITY} value={value} onChange={setValue} />
      <RadioGroup label="Read-only" options={DENSITY} value={value} onChange={setValue} readOnly />
      <RadioGroup label="Disabled" options={DENSITY} value={value} onChange={setValue} disabled />
    </div>
  );
}
