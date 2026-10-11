import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function HalfPicked() {
  const id = useId();
  const [stay, setStay] = useState<DateRange>(['2026-08-04T00:00:00Z', null]);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Stay</FieldLabel>
      <DateRangePicker id={id} value={stay} onChange={setStay} />
    </div>
  );
}
