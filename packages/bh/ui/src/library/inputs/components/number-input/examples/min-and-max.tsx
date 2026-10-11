import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function MinAndMax() {
  const [guests, setGuests] = useState<number | null>(1);
  return (
    <div className="w-160">
      <NumberInput aria-label="Guests" value={guests} onChange={setGuests} min={1} max={8} />
    </div>
  );
}
