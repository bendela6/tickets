import type { ReactNode } from 'react';

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md bg-surface-2/50 px-2 py-2 text-[0.74rem] leading-relaxed text-muted">{children}</div>;
}
