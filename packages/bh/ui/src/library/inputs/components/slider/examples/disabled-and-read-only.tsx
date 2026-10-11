import { useState } from 'react';
import { Slider } from '@bh/ui';

export function DisabledAndReadOnly() {
  const [brightness, setBrightness] = useState(30);
  const [contrast, setContrast] = useState(75);
  return (
    <div className="flex w-256 flex-col gap-16">
      <Slider label="Brightness" disabled value={brightness} onChange={setBrightness} />
      <Slider label="Contrast" readOnly value={contrast} onChange={setContrast} />
    </div>
  );
}
