import { queryOptions } from '@tanstack/react-query';
import type { BoardState, SessionDetail } from '../shared/types';

// The server is the only thing that can read ~/.claude, so every screen here is a
// consumer of these two endpoints. Both poll: sessions change while you are reading.

const POLL_MS = 2_000;

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

export const boardQuery = () =>
  queryOptions({
    queryKey: ['board'],
    queryFn: () => get<BoardState>('/api/state'),
    refetchInterval: POLL_MS,
  });

export const sessionQuery = (id: string) =>
  queryOptions({
    queryKey: ['session', id],
    queryFn: () => get<SessionDetail>(`/api/session/${id}`),
    refetchInterval: POLL_MS,
    // Keep the previous session's data on screen while the next one loads, so
    // switching sessions never flashes an empty pane.
    placeholderData: (prev) => prev,
  });

/** "3m ago" / "2h ago" — the board never shows absolute times except in git. */
export function relative(at: number | null | undefined): string {
  if (!at) return '—';
  const secs = Math.round((Date.now() - at) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** Minutes as a compact duration: 45m, 2h05, 3d. */
export function duration(mins: number | null | undefined): string {
  if (mins == null) return '—';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h${String(mins % 60).padStart(2, '0')}`;
  return `${Math.round(hours / 24)}d`;
}
