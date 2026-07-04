import { createRoute, redirect } from '@tanstack/react-router';
import { fetchJson } from '../api/client';
import type { Board } from '../api/types';
import { projectRoute } from './project-route';

// Bare /p/:key lands on the project's first view.
export const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/',
  beforeLoad: async ({ params }) => {
    const board = await fetchJson<Board>(
      `/api/projects/${encodeURIComponent(params.projectKey)}/board`,
    );
    const firstView = board.views
      .filter((view) => !view.archivedAt)
      .sort((left, right) => left.position - right.position)[0];
    if (firstView) {
      throw redirect({
        to: '/p/$projectKey/v/$viewId',
        params: { projectKey: params.projectKey, viewId: String(firstView.id) },
      });
    }
  },
  component: () => <p style={{ color: 'var(--muted)' }}>This project has no views.</p>,
});
