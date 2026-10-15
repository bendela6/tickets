import { useMediaQuery } from '@bh/hooks';

// Four media queries, each answered as the window and the system change: a
// plain list, no component of bh's.

const QUERIES = [
  { label: 'A window under 768 pixels', query: '(max-width: 767px)' },
  { label: 'A dark system theme', query: '(prefers-color-scheme: dark)' },
  { label: 'Less motion, asked for', query: '(prefers-reduced-motion: reduce)' },
  { label: 'A pointer that hovers', query: '(hover: hover)' },
];

function Answer({ label, query }: { label: string; query: string }) {
  const matches = useMediaQuery(query);
  return (
    <li className="flex items-baseline justify-between gap-16">
      <span>
        {label} <code className="text-11 text-gray-10">{query}</code>
      </span>
      <strong className={matches ? 'text-green-11' : 'text-gray-10'}>
        {matches ? 'Yes' : 'No'}
      </strong>
    </li>
  );
}

export function WhatTheBrowserSays() {
  return (
    <ul className="text-13/19 text-gray-12 flex w-480 flex-col gap-6">
      {QUERIES.map((item) => {
        return <Answer key={item.query} {...item} />;
      })}
    </ul>
  );
}
