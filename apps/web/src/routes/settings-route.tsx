import { createRoute, redirect } from '@tanstack/react-router';
import { SettingsScreen } from '../components/settings/settings-screen';
import type { SettingsTab } from '../components/settings/settings-tabs';
import { rootRoute } from './root-route';

// A project's settings: each tab is a route of its own, so a link (the
// sidebar's, a shared one) opens it and a reload keeps it. The bare
// /p/$projectKey/settings opens the first.
export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'p/$projectKey/settings',
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/p/$projectKey/settings/types', params, replace: true });
  },
});

function tabPage(tab: SettingsTab) {
  return function SettingsTabPage() {
    const { projectKey } = settingsRoute.useParams();
    return <SettingsScreen projectKey={projectKey} tab={tab} />;
  };
}

const typesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'types',
  component: tabPage('types'),
});

const fieldsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'fields',
  component: tabPage('fields'),
});

const workflowRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'workflow',
  component: tabPage('workflow'),
});

const linksRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'links',
  component: tabPage('links'),
});

const repositoryRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'repository',
  component: tabPage('repository'),
});

export const settingsRouteTree = settingsRoute.addChildren([
  settingsIndexRoute,
  typesRoute,
  fieldsRoute,
  workflowRoute,
  linksRoute,
  repositoryRoute,
]);
