import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// Placeholder — the list lives in the mode panel; Task 4 replaces this
// component with the Issues screen.
function SignalsPage() {
  return <AppShell>{null}</AppShell>;
}

export const signalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signals',
  component: SignalsPage,
});
