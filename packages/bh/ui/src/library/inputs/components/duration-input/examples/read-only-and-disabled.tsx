import { useId, useState } from 'react';
import { DurationInput, FieldLabel } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const id = useId();
  const [minutes, setMinutes] = useState<number | null>(150);
  return (
    <div className="flex w-224 flex-col gap-4">
      <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
      <DurationInput id={`${id}-read-only`} value={minutes} onChange={setMinutes} readOnly />
      <FieldLabel htmlFor={`${id}-disabled`} className="mt-8">
        Disabled
      </FieldLabel>
      <DurationInput id={`${id}-disabled`} value={minutes} onChange={setMinutes} disabled />
    </div>
  );
}
