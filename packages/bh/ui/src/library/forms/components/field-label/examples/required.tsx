import { useState } from 'react';
import { FieldLabel, Input } from '@bh/ui';

export function Required() {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  return (
    <div className="flex w-240 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor="name" required>
          Name
        </FieldLabel>
        <Input id="name" value={name} onChange={setName} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor="nickname">Nickname</FieldLabel>
        <Input id="nickname" value={nickname} onChange={setNickname} />
      </div>
    </div>
  );
}
