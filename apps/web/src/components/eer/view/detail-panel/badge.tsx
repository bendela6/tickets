import type { ReactNode } from 'react';

import { cn } from '@tickets/ui';

export type Tone = 'entity' | 'group' | 'subgroup' | 'edge';

const toneClass: Record<Tone, string> = {
  entity: 'bg-blue-9/15 text-blue-9',
  group: 'bg-indigo-9/18 text-indigo-11',
  subgroup: 'bg-green-9/15 text-green-9',
  edge: 'bg-yellow-9/15 text-yellow-9',
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
