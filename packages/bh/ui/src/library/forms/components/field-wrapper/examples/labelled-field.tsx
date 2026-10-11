import { useState } from 'react';
import { FieldWrapper, Input } from '@bh/ui';

export function LabelledField() {
  const [email, setEmail] = useState('');
  return (
    <div className="w-320">
      <FieldWrapper
        name="email"
        label="Email"
        description="Used to sign in."
        required
        touched={false}
        loading={false}
      >
        <Input id="email" type="email" value={email} onChange={setEmail} />
      </FieldWrapper>
    </div>
  );
}
