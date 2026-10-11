import { useId, useState } from 'react';
import { ColorPicker, FieldLabel } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('orange');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <ColorPicker id={`${id}-disabled`} disabled value={colour} onChange={setColour} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <ColorPicker id={`${id}-read-only`} readOnly value={colour} onChange={setColour} />
      </div>
    </div>
  );
}
