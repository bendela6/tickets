import { useState } from 'react';
import { useDebouncedValue } from '@bh/hooks';

// A field and what it searches for: the search follows the text once the
// typing has stopped for 400 milliseconds. A plain input, no component of bh's.

const FRUIT = ['Apple', 'Apricot', 'Banana', 'Blackberry', 'Cherry', 'Grape', 'Lemon', 'Mango'];

export function SearchedOnceTheTypingStops() {
  const [text, setText] = useState('');
  const query = useDebouncedValue(text.trim().toLowerCase(), { delay: 400 });
  const found = FRUIT.filter((fruit) => fruit.toLowerCase().includes(query));
  return (
    <div className="flex w-280 flex-col gap-8">
      <input
        aria-label="Search fruit"
        placeholder="Search fruit"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="border-gray-6 rounded-6 border-1 px-8 py-4"
      />
      <span className="text-12/17 text-gray-10">
        {query === text.trim().toLowerCase() ? `Searched for “${query}”` : 'Typing…'}
      </span>
      <ul className="text-13/19 text-gray-11">
        {found.map((fruit) => {
          return <li key={fruit}>{fruit}</li>;
        })}
      </ul>
    </div>
  );
}
