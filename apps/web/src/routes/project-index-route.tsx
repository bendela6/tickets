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
    const firstView = [...board.views].sort((left, right) => left.id - right.id)[0];
    if (firstView) {
      throw redirect({
        to: '/p/$projectKey/v/$viewId',
        params: { projectKey: params.projectKey, viewId: String(firstView.id) },
      });
    }
  },
  component: () => <p className="py-24 font-sans text-13/19 text-gray-9">This project has no views.</p>,
});
