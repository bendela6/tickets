import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [opens, setOpens] = useState<string | null>('09:00');
  const [closes, setCloses] = useState<string | null>('17:30');
  return (
    <div className="flex w-192 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-opens`}>Opens</FieldLabel>
        <TimePicker id={`${id}-opens`} disabled value={opens} onChange={setOpens} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-closes`}>Closes</FieldLabel>
        <TimePicker id={`${id}-closes`} readOnly value={closes} onChange={setCloses} />
      </div>
    </div>
  );
}
