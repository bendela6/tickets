import { createRoute } from '@tanstack/react-router';
import { ProjectsHome } from '../components/home/projects-home';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

function HomeScreen() {
  return (
    <AppShell>
      <ProjectsHome />
    </AppShell>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeScreen,
});
