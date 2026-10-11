import { useState } from 'react';
import { Checkbox, type Tone } from '@bh/ui';

function Toned({ tone }: { tone: Tone }) {
  const [value, setValue] = useState(true);
  return <Checkbox label={tone} tone={tone} value={value} onChange={setValue} />;
}

export function Tones() {
  return (
    <div className="flex items-center gap-16">
      <Toned tone="primary" />
      <Toned tone="success" />
      <Toned tone="warning" />
      <Toned tone="danger" />
    </div>
  );
}
