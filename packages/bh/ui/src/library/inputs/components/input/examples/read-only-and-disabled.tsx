import { useState } from 'react';
import { Input } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [city, setCity] = useState('Lisbon');
  return (
    <div className="flex w-256 flex-col gap-8">
      <Input aria-label="City, read-only" value={city} onChange={setCity} readOnly />
      <Input aria-label="City, disabled" value={city} onChange={setCity} disabled />
    </div>
  );
}
