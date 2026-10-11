import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [query, setQuery] = useState('report.pdf');
  return (
    <div className="flex w-256 flex-col gap-8">
      <SearchInput aria-label="Search, read-only" value={query} onChange={setQuery} readOnly />
      <SearchInput aria-label="Search, disabled" value={query} onChange={setQuery} disabled />
    </div>
  );
}
