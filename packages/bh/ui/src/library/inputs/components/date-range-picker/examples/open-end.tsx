import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function OpenEnd() {
  const id = useId();
  const [lease, setLease] = useState<DateRange>(['2023-08', null]);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Lease</FieldLabel>
      <DateRangePicker
        id={id}
        granularity="month"
        openEnd="Ongoing"
        value={lease}
        onChange={setLease}
      />
    </div>
  );
}
