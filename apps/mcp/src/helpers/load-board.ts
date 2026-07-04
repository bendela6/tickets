import { apiFetch } from '../api-client';
import type { Board } from '../types';

export function loadBoard(projectKey: string): Promise<Board> {
  return apiFetch<Board>(`/api/projects/${encodeURIComponent(projectKey)}/board`);
}
