import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

const SIZES = ['xs', 'md', 'lg'] as const;

export function Sizes() {
  const id = useId();
  const [time, setTime] = useState<string | null>('14:30');
  return (
    <div className="flex w-192 flex-col gap-12">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex flex-col gap-4">
            <FieldLabel htmlFor={`${id}-${size}`}>{size}</FieldLabel>
            <TimePicker id={`${id}-${size}`} size={size} value={time} onChange={setTime} />
          </div>
        );
      })}
    </div>
  );
}
