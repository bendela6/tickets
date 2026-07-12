import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 border-border bg-surface-2 px-1.5 py-px font-mono text-xs text-ink">
      {children}
    </kbd>
  );
}
