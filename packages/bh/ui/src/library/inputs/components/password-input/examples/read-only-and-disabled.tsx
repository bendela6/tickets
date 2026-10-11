import { useState } from 'react';
import { PasswordInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [password, setPassword] = useState('lemon-tree-42');
  return (
    <div className="flex w-256 flex-col gap-8">
      <PasswordInput
        aria-label="Password, read-only"
        value={password}
        onChange={setPassword}
        readOnly
      />
      <PasswordInput
        aria-label="Password, disabled"
        value={password}
        onChange={setPassword}
        disabled
      />
    </div>
  );
}
