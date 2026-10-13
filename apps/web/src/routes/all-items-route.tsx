import { createRoute } from '@tanstack/react-router';
import { AllItemsScreen } from '../components/all-items/all-items-screen';
import { rootRoute } from './root-route';

// Global cross-project view: no active project, so the sidebar lights
// "All items" rather than a project.
export const allItemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/all',
  component: AllItemsScreen,
});
