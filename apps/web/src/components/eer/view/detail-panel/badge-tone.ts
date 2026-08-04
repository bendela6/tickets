import type { Tone } from '@tickets/ui';

/**
 * What a panel badge is labelling. This vocabulary stays in apps/web —
 * `packages/web/ui/src/components/domain-free.test.ts` fails the build if a
 * library component names a domain concept, and these four are exactly that.
 *
 * Named `BadgeTone`, not `Tone`, because @tickets/ui exports a `Tone` of its
 * own and this folder previously had both under one name.
 */
export type BadgeTone = 'entity' | 'group' | 'subgroup' | 'edge';

export const BADGE_TONE: Record<BadgeTone, Tone> = {
  entity: 'blue',
  group: 'indigo',
  subgroup: 'green',
  edge: 'yellow',
};
