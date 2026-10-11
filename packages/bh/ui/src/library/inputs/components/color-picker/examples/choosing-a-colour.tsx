import { useId, useState } from 'react';
import { ColorPicker, FieldLabel } from '@bh/ui';

export function ChoosingAColour() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('teal');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Colour</FieldLabel>
      <ColorPicker id={id} value={colour} onChange={setColour} />
    </div>
  );
}
