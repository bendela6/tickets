import { useState } from 'react';
import { Slider } from '@bh/ui';

export function RangeAndStep() {
  const [scale, setScale] = useState(1);
  const [threshold, setThreshold] = useState(35);
  return (
    <div className="flex w-256 flex-col gap-16">
      <div className="flex items-center gap-12">
        <Slider
          label="Scale"
          min={0}
          max={2}
          step={0.1}
          value={scale}
          onChange={setScale}
          valueText={`${scale}×`}
        />
        <span className="text-12 text-gray-11 w-40 shrink-0 text-right font-mono">{scale}×</span>
      </div>
      <div className="flex items-center gap-12">
        <Slider
          label="Threshold"
          min={20}
          max={80}
          step={5}
          value={threshold}
          onChange={setThreshold}
        />
        <span className="text-12 text-gray-11 w-40 shrink-0 text-right font-mono">{threshold}</span>
      </div>
    </div>
  );
}
