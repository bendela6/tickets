import type { ReactNode } from 'react';
import { cn } from '@tilewise/ui';

// The sidebar rail's small mono section caption ("PROJECTS", "SCHEMA").
export function RailLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('font-mono text-10 font-500 uppercase tracking-widest text-gray-9', className)}
    >
      {children}
    </span>
  );
}
