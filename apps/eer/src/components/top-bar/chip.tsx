import type { ReactNode } from 'react';

import { cn } from '../../ui/cn';
import { runtimeStyle } from '../../ui/runtime-style';

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
        'border-gray-500 text-gray-50': on,
        'border-gray-600 text-gray-200 line-through opacity-45': !on,
      })}
    >
      <span
        className={cn('h-2 w-2 rounded-full', {
          'bg-(--chip-color)': on && !!color,
          'bg-blue-400': on && !color,
          'bg-gray-400': !on,
        })}
        style={on && color ? runtimeStyle({ '--chip-color': color }) : undefined}
      />
      {children}
    </button>
  );
}
