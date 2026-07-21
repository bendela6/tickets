import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// Placeholder — Task 7 replaces this component with the Session timeline
// screen. Pre-registered here (mirroring how Task 6 pre-registered this same
// way for signals-issue-route.tsx) so Task 6's "full session →" breadcrumb
// link and occurrence-row session links are type-checked against a real
// route.
function SignalsSessionPage() {
  return <AppShell>{null}</AppShell>;
}

export const signalsSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals/sessions/$sessionId',
  component: SignalsSessionPage,
});
