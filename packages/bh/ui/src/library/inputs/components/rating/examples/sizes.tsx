import { useState } from 'react';
import { Rating, type ControlSize } from '@bh/ui';

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState(3);
  return <Rating label={`Quality, ${size}`} size={size} value={value} onChange={setValue} />;
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-12">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
