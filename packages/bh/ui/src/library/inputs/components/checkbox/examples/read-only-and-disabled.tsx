import { useState } from 'react';
import { Checkbox } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState(true);
  return (
    <div className="flex flex-col gap-12">
      <Checkbox label="Editable" value={value} onChange={setValue} />
      <Checkbox label="Read-only" value={value} onChange={setValue} readOnly />
      <Checkbox label="Disabled" value={value} onChange={setValue} disabled />
    </div>
  );
}
