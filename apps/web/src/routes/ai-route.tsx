import { createRoute } from '@tanstack/react-router';
import { AiSessionsScreen } from '../components/ai/ai-sessions-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function AiSessionsPage() {
  return (
    <AppShell>
      <AiSessionsScreen />
    </AppShell>
  );
}

export const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai',
  component: AiSessionsPage,
});
