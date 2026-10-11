import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

const SIZES = ['xs', 'md', 'lg'] as const;

export function Sizes() {
  const id = useId();
  const [day, setDay] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-12">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex flex-col gap-4">
            <FieldLabel htmlFor={`${id}-${size}`}>{size}</FieldLabel>
            <DatePicker id={`${id}-${size}`} size={size} value={day} onChange={setDay} />
          </div>
        );
      })}
    </div>
  );
}
