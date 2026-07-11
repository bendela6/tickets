import type { ReactNode } from 'react';

import { cn } from '../../ui/cn';

export type Tone = 'entity' | 'zone' | 'subgroup' | 'edge';

const toneClass: Record<Tone, string> = {
  entity: 'bg-accent/15 text-accent',
  zone: 'bg-[#9085e9]/18 text-[#b0a8f2]',
  subgroup: 'bg-fk/15 text-fk',
  edge: 'bg-pk/15 text-pk',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.08em]',
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
