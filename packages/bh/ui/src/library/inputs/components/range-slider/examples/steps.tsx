import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function Steps() {
  const [price, setPrice] = useState<[number, number]>([100, 300]);
  return (
    <div className="flex w-320 flex-col gap-8">
      <RangeSlider label="Price" min={0} max={500} step={25} value={price} onChange={setPrice} />
      <span className="text-12 text-gray-11 font-mono">
        {price[0]} to {price[1]}
      </span>
    </div>
  );
}
