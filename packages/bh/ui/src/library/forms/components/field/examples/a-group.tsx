import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function AGroup() {
  const [width, setWidth] = useState('1280');
  const [height, setHeight] = useState('720');
  return (
    <Field label="Size" hint="In pixels, the width then the height." className="w-320">
      <div className="flex items-center gap-8">
        <Input aria-label="Width" inputMode="numeric" value={width} onChange={setWidth} />
        <span aria-hidden className="text-13 text-gray-10">
          ×
        </span>
        <Input aria-label="Height" inputMode="numeric" value={height} onChange={setHeight} />
      </div>
    </Field>
  );
}
