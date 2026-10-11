import { useState } from 'react';
import { Rating } from '@bh/ui';

export function Controlled() {
  const [value, setValue] = useState(3);
  return <Rating label="Quality" value={value} onChange={setValue} />;
}
