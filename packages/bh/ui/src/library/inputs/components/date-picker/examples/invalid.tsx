import { useId, useState } from 'react';
import { DatePicker, FieldError, FieldLabel } from '@bh/ui';

export function Invalid() {
  const id = useId();
  const [start, setStart] = useState<string | null>('2026-07-14T00:00:00Z');
  const [end, setEnd] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-start`}>Start</FieldLabel>
        <DatePicker id={`${id}-start`} value={start} onChange={setStart} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-end`}>End</FieldLabel>
        <DatePicker id={`${id}-end`} tone="danger" value={end} onChange={setEnd} />
        <FieldError>Pick a day after the start.</FieldError>
      </div>
    </div>
  );
}
