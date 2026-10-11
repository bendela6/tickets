import { useState } from 'react';
import { Slider } from '@bh/ui';

export function ShowingTheValue() {
  const [opacity, setOpacity] = useState(60);
  return (
    <div className="flex w-256 items-center gap-12">
      <Slider label="Opacity" value={opacity} onChange={setOpacity} valueText={`${opacity}%`} />
      <span className="text-12 text-gray-11 w-40 shrink-0 text-right font-mono">{opacity}%</span>
    </div>
  );
}
