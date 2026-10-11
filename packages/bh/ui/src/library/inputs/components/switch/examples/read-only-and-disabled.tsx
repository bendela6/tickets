import { useState } from 'react';
import { Switch } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState(true);
  return (
    <div className="flex flex-col gap-12">
      <Switch label="Editable" value={value} onChange={setValue} />
      <Switch label="Read-only" value={value} onChange={setValue} readOnly />
      <Switch label="Disabled" value={value} onChange={setValue} disabled />
    </div>
  );
}
