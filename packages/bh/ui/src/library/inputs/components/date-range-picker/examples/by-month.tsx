import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function ByMonth() {
  const id = useId();
  const [term, setTerm] = useState<DateRange>(['2023-08', '2024-05']);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Term</FieldLabel>
      <DateRangePicker id={id} granularity="month" value={term} onChange={setTerm} />
    </div>
  );
}
