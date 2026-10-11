import { useState } from 'react';
import { Checkbox } from '@bh/ui';

export function WithoutALabel() {
  const [value, setValue] = useState(false);
  return (
    <div className="flex items-center gap-8">
      <Checkbox aria-label="Select report.pdf" value={value} onChange={setValue} />
      <span className="text-13 font-mono">report.pdf</span>
    </div>
  );
}
