import { useState } from 'react';
import { PinInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [code, setCode] = useState('429117');
  return (
    <div className="flex flex-col gap-12">
      <PinInput label="Code, read-only" value={code} onChange={setCode} readOnly />
      <PinInput label="Code, disabled" value={code} onChange={setCode} disabled />
    </div>
  );
}
