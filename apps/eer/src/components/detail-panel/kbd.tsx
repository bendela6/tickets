import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 border-gray-600 bg-gray-800 px-1.5 py-px font-mono text-xs text-gray-50">
      {children}
    </kbd>
  );
}
