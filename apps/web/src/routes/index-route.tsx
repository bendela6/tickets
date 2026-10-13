import { createRoute } from '@tanstack/react-router';
import { ProjectsHome } from '../components/home/projects-home';
import { rootRoute } from './root-route';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ProjectsHome,
});
