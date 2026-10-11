import { useId, useState } from 'react';
import { FieldLabel, NumberInput } from '@bh/ui';

export function EmptyIsNull() {
  const id = useId();
  const [width, setWidth] = useState<number | null>(null);
  return (
    <div className="flex w-160 flex-col gap-4">
      <FieldLabel htmlFor={id}>Width</FieldLabel>
      <NumberInput id={id} value={width} onChange={setWidth} placeholder="Any" />
      <p className="text-12 text-gray-11 font-mono">value: {String(width)}</p>
    </div>
  );
}
