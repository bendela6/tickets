import type { ReactNode } from 'react';

import { cn } from '@tickets/ui';

export type Tone = 'entity' | 'group' | 'subgroup' | 'edge';

// One recipe for all four tones: the hue's solid step at 15% for the fill, and
// its step 11 — Instrument's text rung — for the ink. The map used to be three
// tones at `text-<hue>-9` over `/15` plus one at `text-indigo-11` over `/18`,
// which is both inconsistent and, at 9px, too faint: `text-yellow-9` on
// `bg-yellow-9/15` measures 3.72:1 in light. Step 11 takes the same pill to
// 5.44:1 (yellow) and 6.36:1 (green).
const toneClass: Record<Tone, string> = {
  entity: 'bg-blue-9/15 text-blue-11',
  group: 'bg-indigo-9/15 text-indigo-11',
  subgroup: 'bg-green-9/15 text-green-11',
  edge: 'bg-yellow-9/15 text-yellow-11',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-sm px-8 py-4 font-mono text-9 font-600 uppercase tracking-widest',
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
