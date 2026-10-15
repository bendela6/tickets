import { useRef, useState } from 'react';
import { useHotkeys } from '@bh/hooks';

// A list moved through with J and K, a field found with /, and Escape to
// leave it: plain elements, no component of bh's. The keys work anywhere on
// the page while this example is on it, except in a field.

const FRUIT = ['Apple', 'Banana', 'Cherry', 'Grape', 'Lemon'];

export function KeysForAList() {
  const [at, setAt] = useState(0);
  const [last, setLast] = useState('none yet');
  const field = useRef<HTMLInputElement>(null);
  useHotkeys({
    keys: {
      j: () => {
        setAt((before) => Math.min(FRUIT.length - 1, before + 1));
        setLast('J');
      },
      k: () => {
        setAt((before) => Math.max(0, before - 1));
        setLast('K');
      },
      '/': () => {
        field.current?.focus();
        setLast('/');
      },
    },
    repeat: true,
  });
  // A field takes what is typed in it, so Escape there needs whileTyping.
  useHotkeys({
    keys: {
      escape: () => {
        field.current?.blur();
        setLast('Escape');
      },
    },
    whileTyping: true,
  });
  return (
    <div className="flex w-280 flex-col gap-8">
      <input
        ref={field}
        aria-label="Filter"
        placeholder="Press / to type here"
        className="border-gray-6 rounded-6 border-1 px-8 py-4"
      />
      <ul className="text-13/19 flex flex-col">
        {FRUIT.map((fruit, index) => {
          return (
            <li
              key={fruit}
              aria-current={index === at ? 'true' : undefined}
              className="aria-current:bg-indigo-3 aria-current:text-indigo-12 rounded-4 px-8 py-2"
            >
              {fruit}
            </li>
          );
        })}
      </ul>
      <span className="text-12/17 text-gray-10">Last key: {last}</span>
    </div>
  );
}
