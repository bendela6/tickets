import { useState } from 'react';
import { FieldError, PinInput } from '@bh/ui';

export function ARejectedCode() {
  const [code, setCode] = useState('429117');
  const rejected = code === '429117';
  return (
    <div className="flex flex-col gap-4">
      <PinInput
        label="Verification code"
        value={code}
        onChange={setCode}
        tone={rejected ? 'danger' : undefined}
      />
      {rejected ? <FieldError>That code has expired.</FieldError> : null}
    </div>
  );
}
