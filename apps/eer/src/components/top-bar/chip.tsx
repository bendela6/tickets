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
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm',
        on ? 'border-border-2 text-ink' : 'border-border text-muted line-through opacity-45',
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          on ? (color ? 'bg-(--chip-color)' : 'bg-accent') : 'bg-dim',
        )}
        style={on && color ? runtimeStyle({ '--chip-color': color }) : undefined}
      />
      {children}
    </button>
  );
}
