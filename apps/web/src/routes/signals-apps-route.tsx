import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { AppsScreen } from '../components/signals/apps-screen';
import { rootRoute } from './root-route';

function SignalsAppsPage() {
  return (
    <AppShell>
      <AppsScreen />
    </AppShell>
  );
}

export const signalsAppsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/apps',
  component: SignalsAppsPage,
});
