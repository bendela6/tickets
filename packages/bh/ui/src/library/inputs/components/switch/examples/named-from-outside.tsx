import { useState } from 'react';
import { Switch } from '@bh/ui';

export function NamedFromOutside() {
  const [value, setValue] = useState(false);
  return (
    <div className="flex w-256 items-center justify-between">
      <label htmlFor="dark-mode" className="text-13">
        Dark mode
      </label>
      <Switch id="dark-mode" value={value} onChange={setValue} />
    </div>
  );
}
