import { useQueries } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { Board, Project, StatusKind } from './types';

export interface ProjectStats {
  project: Project;
  counts: Record<StatusKind, number>;
  total: number;
  /** done / total, 0–100 */
  pct: number;
  /** Ticket updates per day, oldest→today, for the activity sparkline. */
  activity: number[];
  lastUpdatedAt: string | null;
}

const KINDS: StatusKind[] = ['todo', 'active', 'blocked', 'done', 'dropped'];
const ACTIVITY_DAYS = 14;

function computeStats(project: Project, board: Board): ProjectStats {
  const statusField = board.fields.find((field) => field.type === 'status');
  const kindByKey = new Map(board.statuses.map((status) => [status.key, status.kind]));
  const counts: Record<StatusKind, number> = {
    todo: 0,
    active: 0,
    blocked: 0,
    done: 0,
    dropped: 0,
  };
  const activity = Array.from({ length: ACTIVITY_DAYS }, () => 0);
  const dayMs = 86_400_000;
  const today = Date.now();
  let lastUpdatedAt: string | null = null;

  for (const ticket of board.tickets) {
    if (ticket.archivedAt) {
      continue;
    }
    const key = statusField ? ticket.values[statusField.key] : undefined;
    const kind = typeof key === 'string' ? kindByKey.get(key) : undefined;
    if (kind) {
      counts[kind] += 1;
    }
    const age = Math.floor((today - new Date(ticket.updatedAt).getTime()) / dayMs);
    if (age >= 0 && age < ACTIVITY_DAYS) {
      const bucket = ACTIVITY_DAYS - 1 - age;
      activity[bucket] = (activity[bucket] ?? 0) + 1;
    }
    if (!lastUpdatedAt || ticket.updatedAt > lastUpdatedAt) {
      lastUpdatedAt = ticket.updatedAt;
    }
  }
  const total = KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  return {
    project,
    counts,
    total,
    pct: total > 0 ? Math.round((counts.done / total) * 100) : 0,
    activity,
    lastUpdatedAt,
  };
}

// One board fetch per project (shared with useBoard's cache key), reduced to
// the numbers the home cards and sidebar mini-bars need.
export function useProjectStats(projects: Project[]) {
  return useQueries({
    queries: projects.map((project) => ({
      queryKey: ['board', project.key],
      queryFn: () => fetchJson<Board>(`/api/projects/${encodeURIComponent(project.key)}/board`),
      staleTime: 30_000,
      select: (board: Board) => computeStats(project, board),
    })),
  });
}
