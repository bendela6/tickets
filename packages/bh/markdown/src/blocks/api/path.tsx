import { Fragment } from 'react';

const PARAM = /(:[A-Za-z_][\w-]*)/g;

/** The route's path in mono, each `:param` segment emboldened in the accent. */
export function Path({ path }: { path: string }) {
  const parts = path.split(PARAM);
  return (
    <code className="text-13 text-gray-12 min-w-0 truncate font-mono">
      {parts.map((part, index) => {
        return part.startsWith(':') ? (
          <b key={index} className="font-600 text-indigo-11">
            {part}
          </b>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        );
      })}
    </code>
  );
}
