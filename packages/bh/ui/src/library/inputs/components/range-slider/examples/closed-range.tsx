import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function ClosedRange() {
  const [points, setPoints] = useState<[number, number]>([3, 3]);
  return (
    <div className="w-320">
      <RangeSlider label="Points" min={0} max={10} value={points} onChange={setPoints} />
    </div>
  );
}
