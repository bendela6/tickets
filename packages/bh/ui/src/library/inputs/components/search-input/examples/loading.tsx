import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function Loading() {
  const [query, setQuery] = useState('report.pdf');
  return (
    <div className="w-256">
      <SearchInput aria-label="Search files" value={query} onChange={setQuery} loading />
    </div>
  );
}
