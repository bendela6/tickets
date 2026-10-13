import { createRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../components/settings/settings-screen';
import { rootRoute } from './root-route';

function SettingsPage() {
  const { projectKey } = settingsRoute.useParams();
  return <SettingsScreen projectKey={projectKey} />;
}

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'p/$projectKey/settings',
  component: SettingsPage,
});
