import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function ShortcutAndClear() {
  const [query, setQuery] = useState('');
  return (
    <div className="w-256">
      <SearchInput aria-label="Search files" value={query} onChange={setQuery} shortcut="mod+K" />
    </div>
  );
}
