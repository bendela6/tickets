import { createRoute } from '@tanstack/react-router';
import { AgentSessionScreen } from '../components/agent/agent-session-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function AgentSessionPage() {
  const { sessionId } = agentSessionRoute.useParams();
  return (
    <AppShell>
      <AgentSessionScreen sessionId={Number(sessionId)} />
    </AppShell>
  );
}

export const agentSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents/$sessionId',
  component: AgentSessionPage,
});
