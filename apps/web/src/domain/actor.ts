import type { ComponentProps } from 'react';
import type { Avatar } from '@tickets/ui';

/** Who or what performed an action. A ticket-domain distinction. */
export type ActorKind = 'human' | 'agent';

// The app's ONE actor-presentation mapping, alongside KIND_ICON/KIND_TONE for
// statuses. `Avatar` deliberately knows nothing about humans and agents — it
// takes a shape, a typeface and a tone — so the domain meaning is assigned
// here and spread into the component:
//
//   <Avatar name={user.name} {...avatarFor(user.kind)} />
//
// A human reads as a round cyan slot in sans; an agent as a square accent
// token in mono, which is the same monospace signal used for ticket keys and
// project prefixes.
export const AVATAR_BY_KIND = {
  human: { shape: 'round', font: 'sans', tone: 'cyan' },
  agent: { shape: 'square', font: 'mono', tone: 'primary' },
} as const satisfies Record<ActorKind, Partial<ComponentProps<typeof Avatar>>>;

export function avatarFor(kind: ActorKind) {
  return AVATAR_BY_KIND[kind];
}
