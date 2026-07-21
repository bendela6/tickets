import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { IssuesScreen } from '../components/signals/issues-screen';
import { rootRoute } from './root-route';

function SignalsPage() {
  return (
    <AppShell>
      <IssuesScreen />
    </AppShell>
  );
}

export const signalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals',
  component: SignalsPage,
});
