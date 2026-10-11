import { useState } from 'react';
import { Checkbox } from '@bh/ui';

export function Controlled() {
  const [value, setValue] = useState(false);
  return <Checkbox label="Email me a copy" value={value} onChange={setValue} />;
}
