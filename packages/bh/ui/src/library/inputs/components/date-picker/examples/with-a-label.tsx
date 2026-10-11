import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [due, setDue] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-4">
      <FieldLabel htmlFor={id}>Due date</FieldLabel>
      <DatePicker id={id} value={due} onChange={setDue} />
    </div>
  );
}
