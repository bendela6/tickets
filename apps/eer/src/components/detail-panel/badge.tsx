import type { ReactNode } from 'react';

import { cn } from '../../ui/cn';

export type Tone = 'entity' | 'zone' | 'subgroup' | 'edge';

const toneClass: Record<Tone, string> = {
  entity: 'bg-accent/15 text-accent',
  zone: 'bg-zone/18 text-zone-ink',
  subgroup: 'bg-fk/15 text-fk',
  edge: 'bg-pk/15 text-pk',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-widest',
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
