import { createRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../components/settings/settings-screen';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function SettingsPage() {
  const { projectKey } = settingsRoute.useParams();
  return (
    <AppShell activeProjectKey={projectKey}>
      <SettingsScreen projectKey={projectKey} />
    </AppShell>
  );
}

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'p/$projectKey/settings',
  component: SettingsPage,
});
