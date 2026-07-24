import type { ReactNode } from 'react';
import { cn } from './cn';

// The sidebar rail's small mono section caption ("AGENTS", "PROJECTS",
// "TERMINALS", "SIGNALS") — retires 4 near-identical spans.
export function RailLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('font-mono text-[10px] font-medium uppercase tracking-(--tracking-mono-label) text-ink-3', className)}
    >
      {children}
    </span>
  );
}
