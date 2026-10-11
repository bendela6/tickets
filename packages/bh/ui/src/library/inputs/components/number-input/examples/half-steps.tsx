import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function HalfSteps() {
  const [hours, setHours] = useState<number | null>(1.5);
  return (
    <div className="w-160">
      <NumberInput
        aria-label="Hours"
        value={hours}
        onChange={setHours}
        min={0}
        max={12}
        step={0.5}
      />
    </div>
  );
}
