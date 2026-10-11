import { useId, useState } from 'react';
import { FieldLabel, IconPicker, type ControlSize } from '@bh/ui';

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>('calendar');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <IconPicker id={`${id}-${size}`} size={size} value={icon} onChange={setIcon} />
          </div>
        );
      })}
    </div>
  );
}
