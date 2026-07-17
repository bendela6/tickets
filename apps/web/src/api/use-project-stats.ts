import { useQueries } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { Board, Project, StatusKind } from './types';
import { indexBoard } from '../utils/index-board';

export interface ProjectStats {
  project: Project;
  counts: Record<StatusKind, number>;
  total: number;
  /** done / total, 0–100 */
  pct: number;
  /** Item updates per day, oldest→today, for the activity sparkline. */
  activity: number[];
  lastUpdatedAt: string | null;
}

const KINDS: StatusKind[] = ['todo', 'active', 'blocked', 'done', 'dropped'];
const ACTIVITY_DAYS = 14;

// Kind comes from the item's OWN type's workflow field's option — not a
// project-wide status list. Each item resolves through indexBoard so types
// with different workflow fields (or none) are handled per item.
function computeStats(project: Project, board: Board): ProjectStats {
  const indexes = indexBoard(board);
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

  for (const item of board.items) {
    if (item.archivedAt) {
      continue;
    }
    const workflowField = indexes.workflowField(item.typeId);
    const raw = workflowField ? item.values[workflowField.key] : undefined;
    const kind =
      workflowField && typeof raw === 'string'
        ? indexes.optionByValue(workflowField, raw)?.kind
        : undefined;
    if (kind) {
      counts[kind] += 1;
    }
    const age = Math.floor((today - new Date(item.updatedAt).getTime()) / dayMs);
    if (age >= 0 && age < ACTIVITY_DAYS) {
      const bucket = ACTIVITY_DAYS - 1 - age;
      activity[bucket] = (activity[bucket] ?? 0) + 1;
    }
    if (!lastUpdatedAt || item.updatedAt > lastUpdatedAt) {
      lastUpdatedAt = item.updatedAt;
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
