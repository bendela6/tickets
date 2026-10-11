import { useId, useState } from 'react';
import { FieldError, FieldLabel, Input } from '@bh/ui';

export function WithAnError() {
  const id = useId();
  const [email, setEmail] = useState('name@');
  const invalid = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Email</FieldLabel>
      <Input
        id={id}
        value={email}
        onChange={setEmail}
        tone={invalid ? 'danger' : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
      />
      {invalid ? <FieldError id={`${id}-error`}>Enter a whole email address.</FieldError> : null}
    </div>
  );
}
