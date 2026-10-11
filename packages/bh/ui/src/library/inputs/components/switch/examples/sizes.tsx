import { useState } from 'react';
import { Switch, type ControlSize } from '@bh/ui';

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState(true);
  return <Switch label={size} size={size} value={value} onChange={setValue} />;
}

export function Sizes() {
  return (
    <div className="flex items-center gap-16">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
