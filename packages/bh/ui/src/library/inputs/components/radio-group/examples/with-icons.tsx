import { useState } from 'react';
import { RadioGroup, type Option } from '@bh/ui';

const SOURCES: Option[] = [
  { value: 'file', label: 'A file', icon: 'file', description: 'One file, from this computer.' },
  {
    value: 'folder',
    label: 'A folder',
    icon: 'folder',
    description: 'Every file in it, in its own folders.',
  },
  {
    value: 'command',
    label: 'A command',
    icon: 'terminal',
    description: 'What it prints, saved as it runs.',
  },
];

export function WithIcons() {
  const [value, setValue] = useState('folder');
  return (
    <RadioGroup
      variant="card"
      layout="grid"
      label="Start from"
      options={SOURCES}
      value={value}
      onChange={setValue}
    />
  );
}
