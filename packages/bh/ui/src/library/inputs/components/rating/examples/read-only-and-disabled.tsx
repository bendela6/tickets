import { useState } from 'react';
import { Rating } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState(3);
  return (
    <div className="flex flex-col gap-12">
      <Rating label="Editable" value={value} onChange={setValue} />
      <Rating label="Read-only" value={value} onChange={setValue} readOnly />
      <Rating label="Disabled" value={value} onChange={setValue} disabled />
    </div>
  );
}
