import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function ASpanOfDays() {
  const id = useId();
  const [dates, setDates] = useState<DateRange>(['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Dates</FieldLabel>
      <DateRangePicker id={id} value={dates} onChange={setDates} />
    </div>
  );
}
