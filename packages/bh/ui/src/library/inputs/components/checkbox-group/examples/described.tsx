import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const NOTICES = [
  { value: 'replies', label: 'Replies', description: 'When someone answers something you wrote.' },
  { value: 'mentions', label: 'Mentions', description: 'When someone names you in a comment.' },
  { value: 'digest', label: 'Weekly digest' },
];

export function Described() {
  const [value, setValue] = useState<string[]>(['mentions']);
  return (
    <CheckboxGroup
      label="Notices"
      className="max-w-320 gap-12"
      options={NOTICES}
      value={value}
      onChange={setValue}
    />
  );
}
