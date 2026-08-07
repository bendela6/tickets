import type { ReactNode } from 'react';

// The small mono chip used for cardinality values ("1-n") — not a diagram card.
export function Card({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-4 bg-gray-4 px-8 py-px font-mono text-10 text-blue-9">{children}</span>
  );
}
