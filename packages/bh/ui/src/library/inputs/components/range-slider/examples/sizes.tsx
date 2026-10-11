import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function Sizes() {
  const [points, setPoints] = useState<[number, number]>([2, 5]);
  return (
    <div className="flex w-320 flex-col gap-16">
      <RangeSlider label="Small" size="xs" min={0} max={10} value={points} onChange={setPoints} />
      <RangeSlider label="Medium" size="md" min={0} max={10} value={points} onChange={setPoints} />
      <RangeSlider label="Large" size="lg" min={0} max={10} value={points} onChange={setPoints} />
    </div>
  );
}
