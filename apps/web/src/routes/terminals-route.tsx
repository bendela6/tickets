import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// The list lives in the mode panel; the main area is a hint until a session is
// opened via /terminals/$sessionId.
function TerminalsPage() {
  return (
    <AppShell>
      <div className="flex h-full items-center justify-center px-6">
        <p className="font-sans text-ui text-gray-9">
          Pick a terminal on the left, or start a new one.
        </p>
      </div>
    </AppShell>
  );
}

export const terminalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terminals',
  component: TerminalsPage,
});
