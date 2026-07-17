import { createRoute } from '@tanstack/react-router';
import { AgentProfileScreen } from '../components/agent/agent-profile-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function AiAgentPage() {
  const { agentId } = aiAgentRoute.useParams();
  return (
    <AppShell>
      <AgentProfileScreen agentId={Number(agentId)} />
    </AppShell>
  );
}

export const aiAgentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents/personas/$agentId',
  component: AiAgentPage,
});
