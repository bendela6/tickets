import type { ReactNode } from 'react';

import { cn } from '../../ui/cn';

export type Tone = 'entity' | 'group' | 'subgroup' | 'edge';

const toneClass: Record<Tone, string> = {
  entity: 'bg-blue-400/15 text-blue-400',
  group: 'bg-violet-400/18 text-violet-300',
  subgroup: 'bg-green-400/15 text-green-400',
  edge: 'bg-yellow-400/15 text-yellow-400',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded px-2 py-1 font-mono text-3xs font-semibold uppercase tracking-widest',
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
