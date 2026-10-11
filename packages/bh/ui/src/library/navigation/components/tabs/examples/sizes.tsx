import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function Sizes() {
  const [value, setValue] = useState('week');
  return (
    <div className="flex flex-col items-start gap-12">
      <Tabs
        variant="pill"
        size="sm"
        items={ITEMS}
        value={value}
        onChange={setValue}
        label="Small"
      />
      <Tabs
        variant="pill"
        size="md"
        items={ITEMS}
        value={value}
        onChange={setValue}
        label="Medium"
      />
      <Tabs
        variant="pill"
        size="lg"
        items={ITEMS}
        value={value}
        onChange={setValue}
        label="Large"
      />
    </div>
  );
}
