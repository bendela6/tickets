import { createRoute } from '@tanstack/react-router';
import { readBuildInfo, VersionPage } from '@bh/shell';
import { rootRoute } from './root-route';

const BUILD = readBuildInfo();

/** The Version page, which the version line opens; nothing in a build made without @bh/shell/vite, as the tests are. */
function VersionScreen() {
  return BUILD ? <VersionPage info={BUILD} /> : null;
}

/** The Version page's overview, and each of its tabs. */
export const versionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/version',
  component: VersionScreen,
});
export const versionTabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/version/$tab',
  component: VersionScreen,
});
