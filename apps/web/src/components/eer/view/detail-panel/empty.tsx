import type { ReactNode } from 'react';

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-6 bg-gray-3/50 px-8 py-8 text-12 leading-relaxed text-gray-11">{children}</div>;
}
