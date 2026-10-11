import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const COLOURS = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState<string[]>(['green']);
  return (
    <div className="flex gap-32">
      <CheckboxGroup
        label="Read-only"
        options={COLOURS}
        value={value}
        onChange={setValue}
        readOnly
      />
      <CheckboxGroup
        label="Disabled"
        options={COLOURS}
        value={value}
        onChange={setValue}
        disabled
      />
    </div>
  );
}
