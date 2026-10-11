import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [count, setCount] = useState<number | null>(3);
  return (
    <div className="flex w-160 flex-col gap-8">
      <NumberInput aria-label="Count, read-only" value={count} onChange={setCount} readOnly />
      <NumberInput aria-label="Count, disabled" value={count} onChange={setCount} disabled />
    </div>
  );
}
