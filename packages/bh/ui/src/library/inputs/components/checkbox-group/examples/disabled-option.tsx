import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const FILES = [
  { value: 'notes', label: 'notes.txt' },
  { value: 'photo', label: 'photo.jpg' },
  { value: 'report', label: 'report.pdf' },
  { value: 'readme', label: 'readme.md', disabled: true },
];

export function DisabledOption() {
  const [value, setValue] = useState<string[]>(['photo', 'readme']);
  return (
    <CheckboxGroup
      label="Files"
      selectAllLabel="All files"
      options={FILES}
      value={value}
      onChange={setValue}
    />
  );
}
