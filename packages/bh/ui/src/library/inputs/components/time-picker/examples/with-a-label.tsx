import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [start, setStart] = useState<string | null>('14:30');
  return (
    <div className="flex w-192 flex-col gap-4">
      <FieldLabel htmlFor={id}>Start time</FieldLabel>
      <TimePicker id={id} value={start} onChange={setStart} />
    </div>
  );
}
