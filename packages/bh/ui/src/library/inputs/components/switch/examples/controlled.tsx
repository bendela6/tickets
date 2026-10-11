import { useState } from 'react';
import { Switch } from '@bh/ui';

export function Controlled() {
  const [value, setValue] = useState(true);
  return <Switch label="Email alerts" value={value} onChange={setValue} />;
}
