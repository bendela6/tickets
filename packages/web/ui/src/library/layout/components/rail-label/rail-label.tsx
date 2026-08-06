import type { ReactNode } from 'react';
import { cn } from '../../../../style/cn';

// The sidebar rail's small mono section caption ("AGENTS", "PROJECTS",
// "TERMINALS", "SIGNALS") — retires 4 near-identical spans.
export function RailLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('font-mono text-10 font-500 uppercase tracking-widest text-gray-9', className)}
    >
      {children}
    </span>
  );
}
