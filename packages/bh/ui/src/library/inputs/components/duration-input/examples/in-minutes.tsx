import { useId, useState } from 'react';
import { DurationInput, FieldLabel } from '@bh/ui';

export function InMinutes() {
  const id = useId();
  const [minutes, setMinutes] = useState<number | null>(null);
  return (
    <div className="flex w-224 flex-col gap-4">
      <FieldLabel htmlFor={id}>Estimate</FieldLabel>
      <DurationInput id={id} value={minutes} onChange={setMinutes} />
      <p className="text-12 text-gray-11 font-mono">value: {String(minutes)}</p>
    </div>
  );
}
