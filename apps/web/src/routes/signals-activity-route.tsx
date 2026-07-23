import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { ActivityScreen } from '../components/signals/activity-screen';
import { rootRoute } from './root-route';

function SignalsActivityPage() {
  return (
    <AppShell>
      <ActivityScreen />
    </AppShell>
  );
}

export const signalsActivityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/activity',
  component: SignalsActivityPage,
});
