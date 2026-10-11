import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

const SIZES = ['xs', 'md', 'lg'] as const;

export function Sizes() {
  const id = useId();
  const [dates, setDates] = useState<DateRange>(['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']);
  return (
    <div className="flex w-256 flex-col gap-12">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex flex-col gap-4">
            <FieldLabel htmlFor={`${id}-${size}`}>{size}</FieldLabel>
            <DateRangePicker id={`${id}-${size}`} size={size} value={dates} onChange={setDates} />
          </div>
        );
      })}
    </div>
  );
}
