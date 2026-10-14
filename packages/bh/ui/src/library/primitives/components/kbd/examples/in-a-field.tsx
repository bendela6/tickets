import { useState } from 'react';
import { Input, Kbd } from '@bh/ui';

export function InAField() {
  const [query, setQuery] = useState('');
  return (
    <div className="w-256">
      <Input
        aria-label="Filter"
        placeholder="Filter components…"
        value={query}
        onChange={setQuery}
        trailing={<Kbd keys="mod+K" aria-hidden />}
      />
    </div>
  );
}
