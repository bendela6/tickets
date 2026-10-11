import { useId, useState } from 'react';
import { ColorPicker, FieldLabel, type ControlSize } from '@bh/ui';

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('blue');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <ColorPicker id={`${id}-${size}`} size={size} value={colour} onChange={setColour} />
          </div>
        );
      })}
    </div>
  );
}
