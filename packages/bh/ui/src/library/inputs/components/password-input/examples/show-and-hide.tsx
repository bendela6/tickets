import { useId, useState } from 'react';
import { FieldLabel, PasswordInput } from '@bh/ui';

export function ShowAndHide() {
  const id = useId();
  const [password, setPassword] = useState('lemon-tree-42');
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Password</FieldLabel>
      <PasswordInput id={id} value={password} onChange={setPassword} />
    </div>
  );
}
