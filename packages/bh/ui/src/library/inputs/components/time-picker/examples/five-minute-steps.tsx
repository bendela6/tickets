import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

export function FiveMinuteSteps() {
  const id = useId();
  const [alarm, setAlarm] = useState<string | null>('09:05');
  return (
    <div className="flex w-192 flex-col gap-4">
      <FieldLabel htmlFor={id}>Alarm</FieldLabel>
      <TimePicker id={id} stepMinutes={5} value={alarm} onChange={setAlarm} />
    </div>
  );
}
