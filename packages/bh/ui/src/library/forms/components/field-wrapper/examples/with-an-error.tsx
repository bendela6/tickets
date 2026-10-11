import { useState } from 'react';
import { FieldWrapper, Input } from '@bh/ui';

export function WithAnError() {
  const [city, setCity] = useState('');
  return (
    <div className="w-320">
      <FieldWrapper
        name="city"
        label="City"
        description="Where you live."
        error="Enter a city"
        required
        touched={false}
        loading={false}
      >
        <Input id="city" value={city} onChange={setCity} tone="danger" />
      </FieldWrapper>
    </div>
  );
}
