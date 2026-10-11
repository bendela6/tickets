import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function Sizes() {
  const [count, setCount] = useState<number | null>(3);
  return (
    <div className="flex w-160 flex-col gap-8">
      <NumberInput size="xs" aria-label="Count, extra small" value={count} onChange={setCount} />
      <NumberInput size="md" aria-label="Count, medium" value={count} onChange={setCount} />
      <NumberInput size="lg" aria-label="Count, large" value={count} onChange={setCount} />
    </div>
  );
}
