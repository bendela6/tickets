import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// Placeholder — Task 6 replaces this component with the Issue detail screen.
// Pre-registered here (mirroring how Task 2 pre-registered /signals and
// /signals/apps) so the Issues screen's row-click navigate() is type-checked
// against a real route.
function SignalsIssuePage() {
  return <AppShell>{null}</AppShell>;
}

export const signalsIssueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/issues/$issueId',
  component: SignalsIssuePage,
});
