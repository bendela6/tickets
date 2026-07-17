import { createRoute } from '@tanstack/react-router';
import { TerminalSessionScreen } from '../components/terminal/terminal-session-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function TerminalSessionPage() {
  const { sessionId } = terminalSessionRoute.useParams();
  return (
    <AppShell>
      <TerminalSessionScreen sessionId={Number(sessionId)} />
    </AppShell>
  );
}

export const terminalSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terminals/$sessionId',
  component: TerminalSessionPage,
});
