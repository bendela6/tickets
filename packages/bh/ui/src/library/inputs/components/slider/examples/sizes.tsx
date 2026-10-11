import { useState } from 'react';
import { Slider } from '@bh/ui';

export function Sizes() {
  const [value, setValue] = useState(40);
  return (
    <div className="flex w-256 flex-col gap-16">
      <Slider label="Small" size="xs" value={value} onChange={setValue} />
      <Slider label="Medium" size="md" value={value} onChange={setValue} />
      <Slider label="Large" size="lg" value={value} onChange={setValue} />
    </div>
  );
}
