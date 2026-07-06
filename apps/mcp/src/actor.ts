import { apiFetch } from './api-client';
import { environment } from './environment';
import type { User } from './types';

export type Actor = { actorId: number; actorName: string };
export type ToolContext = { getActor: () => Promise<Actor> };

// Resolve TICKETS_ACTOR to a user id; every write is attributed to it.
// Created as an agent if it does not exist yet.
async function ensureActor(): Promise<Actor> {
  const existing = await apiFetch<{ data: User[] }>('/api/users');
  const match = existing.data.find((user) => user.name === environment.actorName);
  if (match) {
    return { actorId: match.id, actorName: match.name };
  }
  const created = await apiFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: environment.actorName, kind: 'agent' }),
  });
  return { actorId: created.id, actorName: created.name };
}

// Resolved lazily on the first write tool call — never at startup, so a down
// API cannot kill the server before the stdio transport connects. Memoized on
// success; cleared on failure so the next tool call retries instead of
// caching the outage for the rest of the session.
let actorPromise: Promise<Actor> | null = null;

export function getActor(): Promise<Actor> {
  if (!actorPromise) {
    actorPromise = ensureActor().catch((error: unknown) => {
      actorPromise = null;
      throw error;
    });
  }
  return actorPromise;
}
