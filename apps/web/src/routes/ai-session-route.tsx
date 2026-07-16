import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// Placeholder for the terminal screen — the xterm.js view + socket hook land in
// TIX-193/194. Registered now so the sessions list can link here.
function AiSessionPage() {
  const { sessionId } = aiSessionRoute.useParams();
  return (
    <AppShell>
      <div className="px-6 py-7 font-mono text-ui text-ink-2">session #{sessionId}</div>
    </AppShell>
  );
}

export const aiSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai/$sessionId',
  component: AiSessionPage,
});
