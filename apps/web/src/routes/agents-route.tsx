import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// The list lives in the mode panel; the main area is a hint until a session is
// opened via /agents/$sessionId.
function AgentsPage() {
  return (
    <AppShell>
      <div className="flex h-full items-center justify-center px-6">
        <p className="font-sans text-ui text-gray-9">
          Pick an agent session on the left, or dispatch one from a ticket.
        </p>
      </div>
    </AppShell>
  );
}

export const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents',
  component: AgentsPage,
});
