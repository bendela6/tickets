import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 border-gray-6 bg-gray-3 px-2 py-px font-mono text-xs text-gray-12">
      {children}
    </kbd>
  );
}
