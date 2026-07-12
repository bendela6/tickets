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
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm', {
        'border-border-2 text-ink': on,
        'border-border text-muted line-through opacity-45': !on,
      })}
    >
      <span
        className={cn('h-2 w-2 rounded-full', {
          'bg-(--chip-color)': on && !!color,
          'bg-accent': on && !color,
          'bg-dim': !on,
        })}
        style={on && color ? runtimeStyle({ '--chip-color': color }) : undefined}
      />
      {children}
    </button>
  );
}
