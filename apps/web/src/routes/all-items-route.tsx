import { createRoute } from '@tanstack/react-router';
import { AllItemsScreen } from '../components/all-items/all-items-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// Global cross-project view — no active project, so the shell highlights the
// "All items" nav item instead of a project row.
function AllItemsPage() {
  return (
    <AppShell>
      <AllItemsScreen />
    </AppShell>
  );
}

export const allItemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/all',
  component: AllItemsPage,
});
