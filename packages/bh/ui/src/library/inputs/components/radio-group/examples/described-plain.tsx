import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const COPIES = [
  { value: 'all', label: 'Every version', description: 'Uses the most space.' },
  { value: 'last', label: 'The last ten', description: 'Older ones are removed each night.' },
];

export function DescribedPlain() {
  const [value, setValue] = useState('last');
  return (
    <RadioGroup
      label="Versions kept"
      className="flex-col items-start gap-12"
      options={COPIES}
      value={value}
      onChange={setValue}
    />
  );
}
