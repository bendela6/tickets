import type { ReactNode } from 'react';

import { cn } from '../../ui/cn';

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
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[0.72rem]',
        on ? 'border-border-2 text-ink' : 'border-border text-muted line-through opacity-45',
      )}
    >
      <span
        className={cn('h-2 w-2 rounded-full', on ? 'bg-accent' : 'bg-dim')}
        style={on && color ? { background: color } : undefined}
      />
      {children}
    </button>
  );
}
