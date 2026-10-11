import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function PickingASpan() {
  const [points, setPoints] = useState<[number, number]>([2, 5]);
  return (
    <div className="w-320">
      <RangeSlider label="Points" min={0} max={10} value={points} onChange={setPoints} />
    </div>
  );
}
