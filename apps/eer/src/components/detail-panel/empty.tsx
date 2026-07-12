import type { ReactNode } from 'react';

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md bg-gray-800/50 px-2 py-2 text-sm leading-relaxed text-gray-200">{children}</div>;
}
