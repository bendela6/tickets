import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// Placeholder — Task 5 replaces this component with the Apps screen.
function SignalsAppsPage() {
  return <AppShell>{null}</AppShell>;
}

export const signalsAppsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/apps',
  component: SignalsAppsPage,
});
