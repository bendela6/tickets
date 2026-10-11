import { useId, useState } from 'react';
import { DurationInput, FieldLabel } from '@bh/ui';

export function OverBudget() {
  const id = useId();
  const [minutes, setMinutes] = useState<number | null>(270);
  return (
    <div className="flex w-224 flex-col gap-4">
      <FieldLabel htmlFor={id}>Time spent</FieldLabel>
      <DurationInput id={id} value={minutes} onChange={setMinutes} budgetMinutes={210} />
    </div>
  );
}
