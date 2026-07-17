import { createRouter } from '@tanstack/react-router';
import { agentsRoute } from './routes/agents-route';
import { agentSessionRoute } from './routes/agent-session-route';
import { aiAgentRoute } from './routes/ai-agent-route';
import { aiAgentsRoute } from './routes/ai-agents-route';
import { aiRoute } from './routes/ai-route';
import { allItemsRoute } from './routes/all-items-route';
import { galleryRoute } from './routes/gallery-route';
import { indexRoute } from './routes/index-route';
import { projectIndexRoute } from './routes/project-index-route';
import { projectRoute } from './routes/project-route';
import { rootRoute } from './routes/root-route';
import { schemaRoute } from './routes/schema-route';
import { settingsRoute } from './routes/settings-route';
import { terminalsRoute } from './routes/terminals-route';
import { terminalSessionRoute } from './routes/terminal-session-route';
import { ticketPageRoute } from './routes/ticket-page-route';
import { viewRoute } from './routes/view-route';

const routeTree = rootRoute.addChildren([
  indexRoute,
  allItemsRoute,
  aiRoute,
  terminalsRoute,
  terminalSessionRoute,
  agentsRoute,
  aiAgentsRoute,
  aiAgentRoute,
  agentSessionRoute,
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
