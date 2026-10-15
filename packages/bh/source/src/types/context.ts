import type { Id } from '@bh/resource';

/** Who is asking, and what ends their request. */
export interface Context {
  /** The signed-in user's id, for `isMe`; undefined when no one is. */
  viewer?: Id;
  /** Aborts the source's work when the request goes away. */
  signal?: AbortSignal;
}
