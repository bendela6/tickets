import { useState } from 'react';
import { PinInput } from '@bh/ui';

export function FourCells() {
  const [pin, setPin] = useState('');
  return <PinInput label="PIN" length={4} value={pin} onChange={setPin} />;
}
