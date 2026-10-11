import { useState } from 'react';
import { DatePicker } from '@bh/ui';

export function WithoutAVisibleLabel() {
  const [before, setBefore] = useState<string | null>(null);
  return (
    <div className="w-208">
      <DatePicker
        aria-label="Created before"
        placeholder="Any day"
        value={before}
        onChange={setBefore}
      />
    </div>
  );
}
