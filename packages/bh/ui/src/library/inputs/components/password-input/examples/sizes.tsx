import { useState } from 'react';
import { PasswordInput } from '@bh/ui';

export function Sizes() {
  const [password, setPassword] = useState('lemon-tree-42');
  return (
    <div className="flex w-256 flex-col gap-8">
      <PasswordInput
        size="xs"
        aria-label="Password, extra small"
        value={password}
        onChange={setPassword}
      />
      <PasswordInput
        size="md"
        aria-label="Password, medium"
        value={password}
        onChange={setPassword}
      />
      <PasswordInput
        size="lg"
        aria-label="Password, large"
        value={password}
        onChange={setPassword}
      />
    </div>
  );
}
