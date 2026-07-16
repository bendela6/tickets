import { createRouter } from '@tanstack/react-router';
import { aiAgentsRoute } from './routes/ai-agents-route';
import { aiRoute } from './routes/ai-route';
import { aiSessionRoute } from './routes/ai-session-route';
import { allTicketsRoute } from './routes/all-tickets-route';
import { galleryRoute } from './routes/gallery-route';
import { indexRoute } from './routes/index-route';
import { projectIndexRoute } from './routes/project-index-route';
import { projectRoute } from './routes/project-route';
import { rootRoute } from './routes/root-route';
import { schemaRoute } from './routes/schema-route';
import { settingsRoute } from './routes/settings-route';
import { ticketPageRoute } from './routes/ticket-page-route';
import { viewRoute } from './routes/view-route';

const routeTree = rootRoute.addChildren([
  indexRoute,
  allTicketsRoute,
  aiRoute,
  aiAgentsRoute,
  aiSessionRoute,
  galleryRoute,
  schemaRoute,
  settingsRoute,
  projectRoute.addChildren([projectIndexRoute, viewRoute, ticketPageRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
