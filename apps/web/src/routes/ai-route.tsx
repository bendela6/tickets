import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from './root-route';

export const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai',
  beforeLoad: () => {
    throw redirect({ to: '/terminals' });
  },
});
