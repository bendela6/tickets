import { apiFetch } from './api-client';
import { environment } from './environment';
import type { User } from './types';

// Resolve TICKETS_ACTOR to a user id at startup; every write is attributed to
// it. Created as an agent if it does not exist yet.
export async function ensureActor(): Promise<{ actorId: number; actorName: string }> {
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

export type ToolContext = { actorId: number; actorName: string };
