import { useState } from 'react';
import { Icon, Input } from '@bh/ui';

export function LeadingAndTrailing() {
  const [site, setSite] = useState('');
  const [user, setUser] = useState('');
  return (
    <div className="flex w-256 flex-col gap-8">
      <Input
        aria-label="Website"
        placeholder="Website"
        value={site}
        onChange={setSite}
        leading={<Icon name="link" size="sm" className="text-gray-9" />}
      />
      <Input
        aria-label="Username"
        placeholder="Username"
        value={user}
        onChange={setUser}
        trailing={<span className="text-12 text-gray-9">@example.com</span>}
      />
    </div>
  );
}
