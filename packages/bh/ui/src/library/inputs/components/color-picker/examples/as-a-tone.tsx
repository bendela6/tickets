import { useId, useState } from 'react';
import { ColorPicker, FieldLabel, HUES, Pill } from '@bh/ui';

export function AsATone() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('purple');
  const tone = HUES.find((hue) => hue === colour) ?? 'gray';
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Label colour</FieldLabel>
      <ColorPicker id={id} value={colour} onChange={setColour} />
      <div className="flex gap-8 pt-6">
        <Pill tone={tone} label="Sample" />
        <Pill tone={tone} variant="solid" label="Sample" />
      </div>
    </div>
  );
}
