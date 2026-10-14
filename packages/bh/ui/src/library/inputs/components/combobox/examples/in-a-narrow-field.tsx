import { useState } from 'react';
import { Combobox, type Option } from '@bh/ui';

const SIZES: Option[] = [
  { value: 's', label: 'Small' },
  { value: 'm', label: 'Medium' },
  { value: 'l', label: 'Large' },
  {
    value: 'xl',
    label: 'Extra large',
    disabled: true,
    disabledReason: 'Sold out in this color. More comes in on Friday.',
  },
];

export function InANarrowField() {
  const [size, setSize] = useState<string | null>('m');
  return (
    <div className="w-160">
      <Combobox
        aria-label="Size"
        searchable={false}
        options={SIZES}
        value={size}
        onChange={setSize}
      />
    </div>
  );
}
