import type { ReactNode } from 'react';

import { cn, runtimeStyle } from '@tickets/ui';

export function Chip({
  on,
  color,
  onClick,
  children,
}: {
  on: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex items-center gap-2 rounded-full border px-2 py-1 text-sm', {
        'border-gray-7 text-gray-12': on,
        'border-gray-6 text-gray-11 line-through opacity-45': !on,
      })}
    >
      <span
        className={cn('h-2 w-2 rounded-full', {
          'bg-(--chip-color)': on && !!color,
          'bg-blue-9': on && !color,
          'bg-gray-9': !on,
        })}
        style={on && color ? runtimeStyle({ '--chip-color': color }) : undefined}
      />
      {children}
    </button>
  );
}
