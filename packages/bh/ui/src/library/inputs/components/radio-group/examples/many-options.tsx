import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
  (day) => ({ value: day.toLowerCase(), label: day }),
);

export function ManyOptions() {
  const [value, setValue] = useState('monday');
  return (
    <RadioGroup
      label="First day of the week"
      className="max-w-360 flex-wrap"
      options={DAYS}
      value={value}
      onChange={setValue}
    />
  );
}
