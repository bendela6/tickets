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
      // The OFF state dims through TOKENS, not a blanket opacity: `opacity-45`
      // took the pill's `border-1` outline down to 1.10:1 against the top bar,
      // so the shape vanished and the control stopped reading as a toggle at
      // all. A lighter gray step on that outline, a lower text rung and the
      // strikethrough carry the same "off" meaning while the pill stays visible.
      className={cn('inline-flex items-center gap-8 rounded-full border-1 px-8 py-4 text-12', {
        'border-gray-7 text-gray-12': on,
        'border-gray-6 text-gray-11 line-through': !on,
      })}
    >
      <span
        className={cn('h-8 w-8 rounded-full', {
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
