import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function Sizes() {
  const [query, setQuery] = useState('');
  return (
    <div className="flex w-256 flex-col gap-8">
      <SearchInput size="xs" aria-label="Search, extra small" value={query} onChange={setQuery} />
      <SearchInput size="md" aria-label="Search, medium" value={query} onChange={setQuery} />
      <SearchInput size="lg" aria-label="Search, large" value={query} onChange={setQuery} />
    </div>
  );
}
