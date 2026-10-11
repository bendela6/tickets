import { useState } from 'react';
import { Switch, type Tone } from '@bh/ui';

function Toned({ tone }: { tone: Tone }) {
  const [value, setValue] = useState(true);
  return <Switch label={tone} tone={tone} value={value} onChange={setValue} />;
}

export function Tones() {
  return (
    <div className="flex flex-col gap-8">
      <Toned tone="primary" />
      <Toned tone="secondary" />
      <Toned tone="success" />
      <Toned tone="warning" />
      <Toned tone="danger" />
      <Toned tone="neutral" />
    </div>
  );
}
