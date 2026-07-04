import { createRoute, redirect } from '@tanstack/react-router';
import { fetchJson } from '../api/client';
import type { Project } from '../api/types';
import { STORAGE_KEYS } from '../utils/storage-keys';
import { readLocal } from '../utils/read-local';
import { rootRoute } from './root-route';

function NoProjects() {
  return (
    <div className="wrap">
      <p style={{ color: 'var(--muted)' }}>
        No projects yet — create one: POST /api/projects {'{ key, name, ticketPrefix }'}.
      </p>
    </div>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const stored = readLocal(STORAGE_KEYS.lastProject);
    if (stored) {
      throw redirect({ to: '/p/$projectKey', params: { projectKey: stored } });
    }
    const projects = await fetchJson<{ data: Project[] }>('/api/projects');
    const first = projects.data[0];
    if (first) {
      throw redirect({ to: '/p/$projectKey', params: { projectKey: first.key } });
    }
  },
  component: NoProjects,
});
