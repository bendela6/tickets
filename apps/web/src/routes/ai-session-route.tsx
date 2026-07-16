import { createRoute } from '@tanstack/react-router';
import { SessionScreen } from '../components/ai/session-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function AiSessionPage() {
  const { sessionId } = aiSessionRoute.useParams();
  return (
    <AppShell>
      <SessionScreen sessionId={Number(sessionId)} />
    </AppShell>
  );
}

export const aiSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai/$sessionId',
  component: AiSessionPage,
});
