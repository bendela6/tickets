import { useState } from 'react';
import { Input } from '@bh/ui';

export function Sizes() {
  const [city, setCity] = useState('Lisbon');
  return (
    <div className="flex w-256 flex-col gap-8">
      <Input size="xs" aria-label="City, extra small" value={city} onChange={setCity} />
      <Input size="md" aria-label="City, medium" value={city} onChange={setCity} />
      <Input size="lg" aria-label="City, large" value={city} onChange={setCity} />
    </div>
  );
}
