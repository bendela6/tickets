import { useState } from 'react';
import { PinInput } from '@bh/ui';

export function AVerificationCode() {
  const [code, setCode] = useState('');
  return (
    <div className="flex flex-col gap-8">
      <PinInput label="Verification code" value={code} onChange={setCode} />
      <p className="text-12 text-gray-11 font-mono">value: "{code}"</p>
    </div>
  );
}
