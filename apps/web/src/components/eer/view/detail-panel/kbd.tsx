import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-b-2 border-gray-6 bg-gray-3 px-2 py-px font-mono text-11 text-gray-12">
      {children}
    </kbd>
  );
}
