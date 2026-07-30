import type { ReactNode } from 'react';

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md bg-gray-3/50 px-2 py-2 text-12 leading-relaxed text-gray-11">{children}</div>;
}
