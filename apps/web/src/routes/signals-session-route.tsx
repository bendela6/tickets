import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { SessionScreen } from '../components/signals/session-screen';
import { rootRoute } from './root-route';

function SignalsSessionPage() {
  const { sessionId } = signalsSessionRoute.useParams();
  return (
    <AppShell>
      <SessionScreen sessionId={sessionId} />
    </AppShell>
  );
}

export const signalsSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/sessions/$sessionId',
  component: SignalsSessionPage,
});
