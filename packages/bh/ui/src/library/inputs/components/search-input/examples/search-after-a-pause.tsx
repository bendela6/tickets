import { useState } from 'react';
import { SearchInput } from '@bh/ui';

const CITIES = ['Lisbon', 'Lima', 'Lyon', 'Tbilisi', 'Tallinn', 'Turin'];

export function SearchAfterAPause() {
  const [query, setQuery] = useState('');
  const [searches, setSearches] = useState(0);
  const found = CITIES.filter((city) => city.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex w-256 flex-col gap-8">
      <SearchInput
        aria-label="Search cities"
        value={query}
        commit={{ after: 300 }}
        onChange={(next) => {
          setQuery(next);
          setSearches((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        {found.length > 0 ? found.join(', ') : 'No city'} ({searches}{' '}
        {searches === 1 ? 'search' : 'searches'})
      </p>
    </div>
  );
}
