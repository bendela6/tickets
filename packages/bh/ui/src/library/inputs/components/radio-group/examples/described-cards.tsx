import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const ON_CONFLICT = [
  { value: 'keep', label: 'Keep both', description: 'The new file is saved beside the old one.' },
  { value: 'replace', label: 'Replace', description: 'The old file is written over.' },
  { value: 'ask', label: 'Ask each time', description: 'Nothing changes until you say which.' },
];

export function DescribedCards() {
  const [value, setValue] = useState('keep');
  return (
    <RadioGroup
      variant="card"
      layout="grid"
      label="When a file is already there"
      options={ON_CONFLICT}
      value={value}
      onChange={setValue}
    />
  );
}
