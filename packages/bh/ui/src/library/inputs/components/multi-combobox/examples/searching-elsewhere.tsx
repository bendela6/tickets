import { useEffect, useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

const CITIES: Option[] = [
  'Amsterdam',
  'Berlin',
  'Dublin',
  'Lisbon',
  'Madrid',
  'Oslo',
  'Paris',
  'Prague',
  'Rome',
  'Vienna',
].map((city) => ({ value: city.toLowerCase(), label: city }));

export function SearchingElsewhere() {
  const [cities, setCities] = useState<string[]>(['oslo']);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Option[]>(CITIES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Stands in for a request to a server.
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase();
      setMatches(CITIES.filter((city) => city.label.toLowerCase().includes(needle)));
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // The chosen cities stay in `options`, so their chips keep a label.
  const chosen = CITIES.filter((city) => cities.includes(city.value) && !matches.includes(city));
  return (
    <div className="w-320">
      <MultiCombobox
        placeholder="Cities"
        options={[...chosen, ...matches]}
        value={cities}
        onChange={setCities}
        onSearchChange={setQuery}
        loading={loading}
      />
    </div>
  );
}
