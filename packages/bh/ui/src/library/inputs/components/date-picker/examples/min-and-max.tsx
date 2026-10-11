import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

export function MinAndMax() {
  const id = useId();
  const [delivery, setDelivery] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-4">
      <FieldLabel htmlFor={id}>Delivery date</FieldLabel>
      <DatePicker
        id={id}
        min="2026-07-06"
        max="2026-07-17"
        value={delivery}
        onChange={setDelivery}
      />
    </div>
  );
}
