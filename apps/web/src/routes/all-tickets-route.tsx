import { createRoute } from '@tanstack/react-router';
import { AllTicketsScreen } from '../components/all-tickets/all-tickets-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// Global cross-project view — no active project, so the shell highlights the
// "All tickets" nav item instead of a project row.
function AllTicketsPage() {
  return (
    <AppShell>
      <AllTicketsScreen />
    </AppShell>
  );
}

export const allTicketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/all',
  component: AllTicketsPage,
});
