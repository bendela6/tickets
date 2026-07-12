import type { ReactNode } from 'react';

// The small mono chip used for cardinality values ("1-n") — not a diagram card.
export function Card({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-surface-3 px-1.5 py-px font-mono text-2xs text-accent">{children}</span>
  );
}
