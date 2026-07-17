import { createRoute } from '@tanstack/react-router';
import { AgentLibraryScreen } from '../components/agent/agent-library-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function AiAgentsPage() {
  return (
    <AppShell>
      <AgentLibraryScreen />
    </AppShell>
  );
}

export const aiAgentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents/personas',
  component: AiAgentsPage,
});
