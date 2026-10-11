import { useState } from 'react';
import { Checkbox, type ControlSize } from '@bh/ui';

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState(true);
  return <Checkbox label={size} size={size} value={value} onChange={setValue} />;
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
