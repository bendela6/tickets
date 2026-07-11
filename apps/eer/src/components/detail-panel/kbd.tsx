import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 border-border bg-surface-2 px-[0.35rem] py-[0.05rem] font-mono text-[0.7rem] text-ink">
      {children}
    </kbd>
  );
}
